import z from "zod";
import { prisma } from "../../db.js";
import { creditWallet, debitWallet, InsufficientFundsError } from "../../services/wallet.services.js";
import { debitFund, FundShortfallError, PAWAID_FUND_ID } from "../../services/fund.services.js";

const donationSchema = z.object({
  amount: z
    .number("Amount must be a number.")
    .int("Amount must be a whole number.")
    .min(1, "Amount must be at least 1.")
    .max(1000000, "Amount is too large."),
});

const donationSelect = {
  id: true,
  amount: true,
  destinationType: true,
  createdAt: true,
  // set when the PawAid Fund made the donation; donor is null then
  rescueFundId: true,
  payment: { select: { status: true } },
  rescuePost: { select: { id: true, title: true } },
};

const publicUserSelect = { id: true, name: true, profilePictureUrl: true };


// Every donation on the platform, newest first, showing who gave to whom
export async function listDonations(req, res) {
  try {
    const donations = await prisma.donation.findMany({
      select: {
        ...donationSelect,
        donor: { select: publicUserSelect },
        volunteer: { select: { id: true, user: { select: publicUserSelect } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return res.json({
      message: "Donations listed",
      data: donations,
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch donations" });
  }
}


// Donations the signed in user made, and (for volunteers) the ones they received
export async function myDonations(req, res) {
  try {
    const userId = req.user.id

    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { userId },
      select: { id: true },
    })

    const [made, received] = await Promise.all([
      prisma.donation.findMany({
        where: { donorId: userId },
        select: {
          ...donationSelect,
          volunteer: { select: { id: true, user: { select: publicUserSelect } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      volunteer
        ? prisma.donation.findMany({
            where: { volunteerId: volunteer.id },
            select: { ...donationSelect, donor: { select: publicUserSelect } },
            orderBy: { createdAt: "desc" },
          })
        : [],
    ])

    return res.json({
      message: "Donations listed",
      data: { made, received },
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch donations" });
  }
}


export async function donateToVolunteer(req, res) {
  try {
    const parsed = donationSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { amount } = parsed.data
    const donorId = req.user.id

    // a malformed id makes the lookup throw, treat it the same as a missing volunteer
    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { id: req.params.volunteerId },
      include: { user: { select: { name: true, wallet: true } } },
    }).catch(() => null)

    if (!volunteer?.user.wallet || volunteer.status !== "ACTIVE") {
      return res.status(404).json({ message: "Volunteer not found" })
    }

    if (volunteer.userId === donorId) {
      return res.status(400).json({ message: "You cannot donate to yourself" })
    }

    // Donations are paid only from the donor's wallet; money enters the platform
    // through wallet top ups alone
    const donorWallet = await prisma.wallet.findUnique({ where: { userId: donorId } })

    if (!donorWallet) {
      return res.status(404).json({ message: "Wallet not found" })
    }

    // fail fast with a clear message; debitWallet re-checks atomically inside the transaction
    if (donorWallet.balance < amount) {
      return res.status(400).json({ message: "Not enough money in your wallet" })
    }

    const donation = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          amount,
          method: "WALLET",
          status: "COMPLETED",
          reference: "WALLET_DONATION",
        },
      });

      const donation = await tx.donation.create({
        data: {
          donorId,
          volunteerId: volunteer.id,
          paymentId: payment.id,
          amount,
          destinationType: "VOLUNTEER",
        },
        select: donationSelect,
      });

      const transaction = await tx.financialTransaction.create({
        data: {
          type: "DONATION",
          source: "DONATION",
          destination: "VOLUNTEER",
          amount,
          relatedUserId: donorId,
          relatedVolunteerId: volunteer.id,
          paymentId: payment.id,
          donationId: donation.id,
          status: "COMPLETED",
          reference: "Donation",
        },
      });

      // throws InsufficientFundsError, which rolls the whole donation back
      await debitWallet(tx, {
        walletId: donorWallet.id,
        amount,
        transactionId: transaction.id,
        reference: `Donation to ${volunteer.user.name}`,
      });

      await creditWallet(tx, {
        walletId: volunteer.user.wallet.id,
        amount,
        transactionId: transaction.id,
        reference: "Donation",
      });

      return donation
    });

    return res.status(201).json({
      message: "Donation successful",
      data: donation,
    })
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(400).json({ message: "Not enough money in your wallet" })
    }
    console.error(error);
    res.status(500).json({ message: "Failed to donate" });
  }
}


// statuses a rescue can still raise money in
const DONATABLE_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS"]

class PostDonationError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

// Adds a donation to a rescue post's total, for donateToPost and donateFromFund.
// Updating the post first locks its row, so a volunteer claiming the rescue at the
// same moment either sees this donation in donationReceived (and moves it) or has
// already been assigned (and the caller credits them). It is never lost or moved twice.
async function addToPost(tx, postId, amount) {
  const { count } = await tx.rescuePost.updateMany({
    where: { id: postId, status: { in: DONATABLE_STATUSES }, donationTarget: { gt: 0 } },
    data: { donationReceived: { increment: amount } },
  })
  if (count === 0) {
    throw new PostDonationError("This rescue is not accepting donations")
  }

  const post = await tx.rescuePost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      donationReceived: true,
      assignedVolunteer: {
        select: {
          id: true,
          status: true,
          userId: true,
          user: { select: { wallet: { select: { id: true } } } },
        },
      },
    },
  })

  const volunteer = post.assignedVolunteer
  if (volunteer && (volunteer.status !== "ACTIVE" || !volunteer.user.wallet)) {
    throw new PostDonationError("This rescue's volunteer is not active right now", 409)
  }

  return post
}

// Donate to a rescue post. With a volunteer on the rescue the money goes straight
// to their wallet; without one it stays on the post until a volunteer takes it,
// and assignPost moves it to their wallet then (PRD §9)
export async function donateToPost(req, res) {
  try {
    const postId = z.uuid().safeParse(req.params.postId)
    if (!postId.success) {
      return res.status(404).json({ message: "Post not found" })
    }

    const parsed = donationSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { amount } = parsed.data
    const donorId = req.user.id

    const post = await prisma.rescuePost.findUnique({
      where: { id: postId.data },
      select: { id: true, creatorId: true },
    })
    if (!post) {
      return res.status(404).json({ message: "Post not found" })
    }

    if (post.creatorId === donorId) {
      return res.status(400).json({ message: "You cannot donate to your own rescue post" })
    }

    const donorWallet = await prisma.wallet.findUnique({ where: { userId: donorId } })
    if (!donorWallet) {
      return res.status(404).json({ message: "Wallet not found" })
    }

    // fail fast with a clear message; debitWallet re-checks atomically inside the transaction
    if (donorWallet.balance < amount) {
      return res.status(400).json({ message: "Not enough money in your wallet" })
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await addToPost(tx, post.id, amount)

      const volunteer = updatedPost.assignedVolunteer
      if (volunteer?.userId === donorId) {
        throw new PostDonationError("You cannot donate to a rescue you are handling")
      }

      const payment = await tx.payment.create({
        data: {
          amount,
          method: "WALLET",
          status: "COMPLETED",
          reference: "WALLET_DONATION",
        },
      });

      const donation = await tx.donation.create({
        data: {
          donorId,
          rescuePostId: post.id,
          volunteerId: volunteer?.id ?? null,
          paymentId: payment.id,
          amount,
          destinationType: "RESCUE_POST",
        },
        select: donationSelect,
      });

      const transaction = await tx.financialTransaction.create({
        data: {
          type: "DONATION",
          source: "DONATION",
          // unassigned money is held by the post until a volunteer takes it
          destination: volunteer ? "VOLUNTEER" : "RESCUE_POST",
          amount,
          relatedUserId: donorId,
          relatedVolunteerId: volunteer?.id ?? null,
          relatedPostId: post.id,
          paymentId: payment.id,
          donationId: donation.id,
          status: "COMPLETED",
          reference: "Rescue donation",
        },
      });

      // throws InsufficientFundsError, which rolls the whole donation back
      await debitWallet(tx, {
        walletId: donorWallet.id,
        amount,
        transactionId: transaction.id,
        reference: `Donation to ${updatedPost.title}`,
      });

      if (volunteer) {
        await creditWallet(tx, {
          walletId: volunteer.user.wallet.id,
          amount,
          transactionId: transaction.id,
          reference: `Donation for ${updatedPost.title}`,
        });
      }

      return {
        donation,
        post: { id: updatedPost.id, donationReceived: updatedPost.donationReceived },
      }
    });

    return res.status(201).json({
      message: "Donation successful",
      data: result,
    })
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(400).json({ message: "Not enough money in your wallet" })
    }
    if (error instanceof PostDonationError) {
      return res.status(error.statusCode).json({ message: error.message })
    }
    console.error(error);
    res.status(500).json({ message: "Failed to donate" });
  }
}


// ========================================
// PAWAID FUND DONATIONS (admin only)
// ========================================

const fundDonationSchema = donationSchema.extend({
  destinationType: z.enum(["VOLUNTEER", "RESCUE_POST"], "Choose a volunteer or a rescue post."),
  targetId: z.uuid("Choose who to donate to."),
})

// An admin gives money from the PawAid Fund to a volunteer or a rescue post. It is
// recorded as a donation with the fund as the donor, so it shows up in the donation
// lists, and the ledger entry names the admin who made it (PRD §17, §18)
export async function donateFromFund(req, res) {
  try {
    const parsed = fundDonationSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { amount, destinationType, targetId } = parsed.data
    const toPost = destinationType === "RESCUE_POST"

    const donation = await prisma.$transaction(async (tx) => {
      // throws FundShortfallError, which rolls the whole donation back
      await debitFund(tx, amount)

      let volunteer = null
      let post = null

      if (toPost) {
        post = await tx.rescuePost.findUnique({ where: { id: targetId }, select: { id: true } })
        if (!post) throw new PostDonationError("Rescue post not found", 404)
        post = await addToPost(tx, post.id, amount)
        volunteer = post.assignedVolunteer
      } else {
        volunteer = await tx.volunteerProfile.findUnique({
          where: { id: targetId },
          select: { id: true, status: true, user: { select: { name: true, wallet: { select: { id: true } } } } },
        })
        if (!volunteer?.user.wallet || volunteer.status !== "ACTIVE") {
          throw new PostDonationError("Volunteer not found", 404)
        }
      }

      const payment = await tx.payment.create({
        data: { amount, method: "OTHER", status: "COMPLETED", reference: "PAWAID_FUND" },
      })

      const donation = await tx.donation.create({
        data: {
          rescueFundId: PAWAID_FUND_ID,
          rescuePostId: post?.id ?? null,
          volunteerId: volunteer?.id ?? null,
          paymentId: payment.id,
          amount,
          destinationType,
        },
        select: donationSelect,
      })

      const transaction = await tx.financialTransaction.create({
        data: {
          type: "RESCUE_FUND_ALLOCATION",
          source: "PAWAID_FUND",
          // money for a rescue nobody has taken yet is held by the post
          destination: volunteer ? "VOLUNTEER" : "RESCUE_POST",
          amount,
          // the admin who made the donation
          relatedUserId: req.user.id,
          relatedVolunteerId: volunteer?.id ?? null,
          relatedPostId: post?.id ?? null,
          paymentId: payment.id,
          donationId: donation.id,
          rescueFundId: PAWAID_FUND_ID,
          status: "COMPLETED",
          reference: post ? `PawAid Fund donation to ${post.title}` : `PawAid Fund donation to ${volunteer.user.name}`,
        },
      })

      if (volunteer) {
        await creditWallet(tx, {
          walletId: volunteer.user.wallet.id,
          amount,
          transactionId: transaction.id,
          reference: post ? `PawAid Fund donation for ${post.title}` : "PawAid Fund donation",
        })
      }

      return donation
    }, { maxWait: 10000, timeout: 20000 })

    return res.status(201).json({ message: "Donation sent from the PawAid Fund", data: donation })
  } catch (error) {
    if (error instanceof FundShortfallError) {
      return res.status(400).json({ message: "Not enough money in the PawAid Fund" })
    }
    if (error instanceof PostDonationError) {
      return res.status(error.statusCode).json({ message: error.message })
    }
    console.error(error);
    res.status(500).json({ message: "Failed to donate from the fund" });
  }
}
