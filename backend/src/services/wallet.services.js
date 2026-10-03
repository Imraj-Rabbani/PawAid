// Wallet balance changes. Call these inside a prisma.$transaction so the balance
// and its WalletTransaction row are always written together.

export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient wallet balance")
    this.statusCode = 400
  }
}


export async function creditWallet(tx, { walletId, amount, transactionId, reference }) {
  await tx.walletTransaction.create({
    data: { walletId, relatedTransactionId: transactionId, amount, type: "CREDIT", reference },
  })

  return tx.wallet.update({
    where: { id: walletId },
    data: { balance: { increment: amount } },
  })
}


export async function debitWallet(tx, { walletId, amount, transactionId, reference }) {
  // the balance check and the deduction are one statement, so two payments
  // racing each other can't both spend the same money
  const { count } = await tx.wallet.updateMany({
    where: { id: walletId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  })

  if (count === 0) throw new InsufficientFundsError()

  await tx.walletTransaction.create({
    data: { walletId, relatedTransactionId: transactionId, amount, type: "DEBIT", reference },
  })
}
