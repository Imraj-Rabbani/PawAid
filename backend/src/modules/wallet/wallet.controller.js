import z from "zod";
import { prisma } from "../../db.js";
import { creditWallet } from "../../services/wallet.services.js";

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
