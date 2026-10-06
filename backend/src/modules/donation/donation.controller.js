import z from "zod";
import { prisma } from "../../db.js";
import { creditWallet, debitWallet, InsufficientFundsError } from "../../services/wallet.services.js";

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
