// Reconciliation: checks that the stored running totals agree with the rows
// they summarise. Every money flow writes the total and its rows in one
// transaction, so any mismatch here means a bug. Read only.
// Used by the tests after every money flow, and by scripts/check-ledger.js.

// Returns a list of human readable problems; empty means the ledger is consistent
export async function findLedgerProblems(db) {
  const problems = []

  // a wallet's balance is its credits minus its debits
  const wallets = await db.$queryRaw`
    SELECT w.id, w.balance,
           COALESCE(SUM(CASE WHEN wt.type = 'CREDIT' THEN wt.amount ELSE -wt.amount END), 0)::int AS ledger
    FROM wallets w
    LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
    GROUP BY w.id
    HAVING w.balance < 0
        OR w.balance <> COALESCE(SUM(CASE WHEN wt.type = 'CREDIT' THEN wt.amount ELSE -wt.amount END), 0)
  `
  for (const w of wallets) {
    problems.push(`Wallet ${w.id} has balance ${w.balance} but its transactions add up to ${w.ledger}`)
  }

  const badRows = await db.$queryRaw`SELECT id, amount FROM wallet_transactions WHERE amount <= 0`
  for (const row of badRows) {
    problems.push(`Wallet transaction ${row.id} has a non-positive amount ${row.amount}`)
  }

  // a post's donationReceived is everything donated to it that wasn't refunded
  const posts = await db.$queryRaw`
    SELECT p.id, p.donation_received AS received,
           COALESCE(SUM(d.amount) FILTER (WHERE pay.status <> 'REFUNDED'), 0)::int AS donated
    FROM rescue_posts p
    LEFT JOIN donations d ON d.rescue_post_id = p.id
    LEFT JOIN payments pay ON pay.id = d.payment_id
    GROUP BY p.id
    HAVING p.donation_received <> COALESCE(SUM(d.amount) FILTER (WHERE pay.status <> 'REFUNDED'), 0)
  `
  for (const p of posts) {
    problems.push(`Post ${p.id} shows ${p.received} received but its donations add up to ${p.donated}`)
  }

  // the fund has received its marketplace profit and given out its unrefunded donations
  const funds = await db.$queryRaw`
    SELECT f.id, f.total_available AS available, f.total_used AS used,
      (SELECT COALESCE(SUM(ft.amount), 0)::int FROM financial_transactions ft
        WHERE ft.rescue_fund_id = f.id AND ft.type = 'MARKETPLACE_PROFIT' AND ft.status = 'COMPLETED') AS profit,
      (SELECT COALESCE(SUM(d.amount), 0)::int FROM donations d JOIN payments pay ON pay.id = d.payment_id
        WHERE d.rescue_fund_id = f.id AND pay.status <> 'REFUNDED') AS donated
    FROM rescue_funds f
  `
  for (const f of funds) {
    if (f.available !== f.profit) {
      problems.push(`Fund ${f.id} has total_available ${f.available} but its marketplace profit adds up to ${f.profit}`)
    }
    if (f.used !== f.donated) {
      problems.push(`Fund ${f.id} has total_used ${f.used} but its donations add up to ${f.donated}`)
    }
  }

  return problems
}
