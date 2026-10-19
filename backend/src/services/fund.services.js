// The PawAid Fund: marketplace profit collects here and admins donate from it.
// Call these inside a prisma.$transaction, alongside the FinancialTransaction
// row that records the movement.

// the single fund row, created by the 20261015120000_pawaid_fund migration
export const PAWAID_FUND_ID = "00000000-0000-4000-8000-000000000001"

export class FundShortfallError extends Error {
  constructor() {
    super("Not enough money in the PawAid Fund")
    this.statusCode = 400
  }
}


export function creditFund(tx, amount) {
  // upsert in case the row was ever removed; normally it is just the increment
  return tx.rescueFund.upsert({
    where: { id: PAWAID_FUND_ID },
    create: { id: PAWAID_FUND_ID, totalAvailable: amount },
    update: { totalAvailable: { increment: amount } },
  })
}


// gives back money the fund donated, e.g. to a rescue that was taken down
// before a volunteer took it; the not-overdrawn check keeps total_used >= 0
export function refundFund(tx, amount) {
  return tx.rescueFund.update({
    where: { id: PAWAID_FUND_ID },
    data: { totalUsed: { decrement: amount } },
  })
}


export async function debitFund(tx, amount) {
  // the balance check and the deduction are one statement (Prisma can't compare
  // two columns in a where), so two donations can't both spend the same money
  const count = await tx.$executeRaw`
    UPDATE rescue_funds
    SET total_used = total_used + ${amount}, updated_at = NOW()
    WHERE id = ${PAWAID_FUND_ID}::uuid AND total_available - total_used >= ${amount}
  `

  if (count === 0) throw new FundShortfallError()
}
