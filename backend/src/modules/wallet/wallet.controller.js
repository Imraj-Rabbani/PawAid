import z from "zod";
import { prisma } from "../../db.js";
import { creditWallet, debitWallet, InsufficientFundsError } from "../../services/wallet.services.js";

const topUpSchema = z.object({
  amount: z
    .number("Amount must be a number.")
    .int("Amount must be a whole number.")
    .min(1, "Amount must be at least 1.")
    .max(1000000, "Amount is too large."),
});


export async function topUpWallet(req, res) {
  try {
    const parsed = topUpSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { amount } = parsed.data
    const userId = req.user.id

    const wallet = await prisma.wallet.findUnique({ where: { userId } })

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" })
    }

    // Dummy top up: no money is collected, the payment is recorded as completed
    // straight away. Replace the payment step with the gateway flow later.
    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          amount,
          method: "OTHER",
          status: "COMPLETED",
          reference: "DUMMY_TOP_UP",
        },
      });

      const transaction = await tx.financialTransaction.create({
        data: {
          type: "INCOME",
          source: "TOP_UP",
          destination: "WALLET",
          amount,
          relatedUserId: userId,
          paymentId: payment.id,
          status: "COMPLETED",
          reference: "Wallet top up",
        },
      });

      return creditWallet(tx, {
        walletId: wallet.id,
        amount,
        transactionId: transaction.id,
        reference: "Wallet top up",
      });
    });

    return res.json({
      message: "Wallet topped up",
      data: updated
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to top up wallet" });
  }
}


export async function myWallet(req, res) {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
      select: { id: true, balance: true, updatedAt: true },
    })

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" })
    }

    return res.json({ message: "Wallet sent", data: wallet })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch wallet" });
  }
}


const publicUserSelect = { id: true, name: true, profilePictureUrl: true };

// The signed in user's own wallet history, newest first. Unlike the public
// volunteer profile, the owner may see who their money came from and went to.
export async function myWalletTransactions(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50)
    const cursor = z.uuid().safeParse(req.query.cursor)

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
      select: { id: true, balance: true },
    })

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" })
    }

    const [transactions, totals] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        select: {
          id: true,
          amount: true,
          type: true,
          reference: true,
          createdAt: true,
          relatedTransaction: {
            select: {
              type: true,
              source: true,
              destination: true,
              // a transfer's note lives here
              reference: true,
              relatedUser: { select: publicUserSelect },
              relatedVolunteer: { select: { id: true, user: { select: publicUserSelect } } },
              relatedPost: { select: { id: true, title: true } },
            },
          },
        },
        // one extra row tells us whether there is another page
        take: limit + 1,
        ...(cursor.success && { cursor: { id: cursor.data }, skip: 1 }),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      prisma.walletTransaction.groupBy({
        by: ["type"],
        where: { walletId: wallet.id },
        _sum: { amount: true },
      }),
    ])

    const hasMore = transactions.length > limit
    if (hasMore) transactions.pop()

    const sumOf = (type) => totals.find((t) => t.type === type)?._sum.amount ?? 0

    return res.json({
      message: "Wallet transactions listed",
      data: transactions,
      summary: { balance: wallet.balance, totalIn: sumOf("CREDIT"), totalOut: sumOf("DEBIT") },
      nextCursor: hasMore ? transactions[transactions.length - 1].id : null,
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch wallet transactions" });
  }
}


const transferSchema = z.object({
  volunteerId: z.uuid("Please choose a volunteer."),
  amount: z
    .number("Amount must be a number.")
    .int("Amount must be a whole number.")
    .min(1, "Amount must be at least 1.")
    .max(1000000, "Amount is too large."),
  note: z.string().trim().max(200, "Note is too long.").optional(),
});

// Volunteer to volunteer transfer (PRD §13). Use after requireActiveVolunteer.
// One FinancialTransaction records sender (relatedUser), receiver (relatedVolunteer),
// amount, time and note; each wallet gets its own DEBIT / CREDIT row.
export async function transferToVolunteer(req, res) {
  try {
    const parsed = transferSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { volunteerId, amount } = parsed.data
    const note = parsed.data.note || null
    const sender = req.volunteer

    if (volunteerId === sender.id) {
      return res.status(400).json({ message: "You cannot transfer to yourself" })
    }

    const [senderWallet, recipient] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: sender.userId } }),
      prisma.volunteerProfile.findUnique({
        where: { id: volunteerId },
        select: {
          id: true,
          status: true,
          userId: true,
          user: { select: { name: true, status: true, wallet: { select: { id: true } } } },
        },
      }),
    ])

    if (!senderWallet) {
      return res.status(404).json({ message: "Wallet not found" })
    }

    // revoked volunteers and suspended accounts can't receive transfers
    if (!recipient?.user.wallet || recipient.status !== "ACTIVE" || recipient.user.status !== "ACTIVE") {
      return res.status(404).json({ message: "Volunteer not found" })
    }

    // fail fast with a clear message; debitWallet re-checks atomically inside the transaction
    if (senderWallet.balance < amount) {
      return res.status(400).json({ message: "Not enough money in your wallet" })
    }

    const wallet = await prisma.$transaction(async (tx) => {
      const transaction = await tx.financialTransaction.create({
        data: {
          type: "TRANSFER",
          source: "VOLUNTEER",
          destination: "VOLUNTEER",
          amount,
          relatedUserId: sender.userId,
          relatedVolunteerId: recipient.id,
          status: "COMPLETED",
          reference: note ?? "Volunteer transfer",
        },
      });

      // throws InsufficientFundsError, which rolls the whole transfer back
      await debitWallet(tx, {
        walletId: senderWallet.id,
        amount,
        transactionId: transaction.id,
        reference: `Transfer to ${recipient.user.name}`,
      });

      await creditWallet(tx, {
        walletId: recipient.user.wallet.id,
        amount,
        transactionId: transaction.id,
        reference: `Transfer from ${req.user.name}`,
      });

      return tx.wallet.findUnique({
        where: { id: senderWallet.id },
        select: { id: true, balance: true, updatedAt: true },
      })
    });

    return res.status(201).json({
      message: `Sent ৳${amount.toLocaleString()} to ${recipient.user.name}`,
      data: wallet,
    })
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(400).json({ message: "Not enough money in your wallet" })
    }
    console.error(error);
    res.status(500).json({ message: "Failed to transfer" });
  }
}
