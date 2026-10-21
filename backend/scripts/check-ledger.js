// Checks the database in DATABASE_URL for wallets, posts or the PawAid Fund whose
// totals disagree with their transaction rows. Read only.
//   npm run check:ledger
import { prisma } from "../src/db.js"
import { findLedgerProblems } from "../src/services/ledger.services.js"

const problems = await findLedgerProblems(prisma)
await prisma.$disconnect()

if (problems.length === 0) {
  console.log("Ledger is consistent")
} else {
  console.error(`${problems.length} problem(s) found:`)
  for (const problem of problems) console.error(`- ${problem}`)
  process.exitCode = 1
}
