import z from "zod";
import { prisma } from "../../db.js";

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

    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { userId },
      include: { wallet: true },
    })

    if (!volunteer?.wallet) {
      return res.status(403).json({ message: "Only volunteers have a wallet" })
    }

    // Dummy top up: no money is collected, the payment is recorded as completed
    // straight away. Replace the payment step with the gateway flow later.
    const wallet = await prisma.$transaction(async (tx) => {
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
          relatedVolunteerId: volunteer.id,
          paymentId: payment.id,
          status: "COMPLETED",
          reference: "Wallet top up",
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: volunteer.wallet.id,
          relatedTransactionId: transaction.id,
          amount,
          type: "CREDIT",
          reference: "Wallet top up",
        },
      });

      return tx.wallet.update({
        where: { id: volunteer.wallet.id },
        data: { balance: { increment: amount } },
      });
    });

    return res.json({
      message: "Wallet topped up",
      data: wallet
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to top up wallet" });
  }
}
