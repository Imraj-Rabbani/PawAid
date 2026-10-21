import { describe, expect, it } from "vitest"
import { prisma } from "../src/db.js"
import { PAWAID_FUND_ID } from "../src/services/fund.services.js"
import { findLedgerProblems } from "../src/services/ledger.services.js"
import { createPost, createUser, createVolunteer, post, seedFund, topUp } from "./helpers.js"

// The other tests trust findLedgerProblems to spot drift, so check it really does
describe("findLedgerProblems", () => {
  it("passes a ledger written only through the API", async () => {
    const donor = await createUser()
    const volunteer = await createVolunteer()
    await topUp(donor, 500)
    await seedFund(300)

    const res = await post(`/donations/volunteer/${volunteer.volunteer.id}`, { token: donor.token, body: { amount: 200 } })
    expect(res.status).toBe(201)

    expect(await findLedgerProblems(prisma)).toEqual([])
  })

  it("reports a wallet balance changed without a transaction row", async () => {
    const user = await createUser()
    await topUp(user, 100)
    await prisma.wallet.update({ where: { userId: user.id }, data: { balance: 150 } })

    const problems = await findLedgerProblems(prisma)
    expect(problems).toEqual([expect.stringContaining(`Wallet ${user.wallet.id} has balance 150`)])
  })

  it("reports a post total that doesn't match its donations", async () => {
    const creator = await createUser()
    const rescue = await createPost({ creator })
    await prisma.rescuePost.update({ where: { id: rescue.id }, data: { donationReceived: 40 } })

    const problems = await findLedgerProblems(prisma)
    expect(problems).toEqual([expect.stringContaining(`Post ${rescue.id} shows 40 received`)])
  })

  it("reports fund totals that don't match the fund's rows", async () => {
    await seedFund(100)
    await prisma.rescueFund.update({ where: { id: PAWAID_FUND_ID }, data: { totalAvailable: 120, totalUsed: 10 } })

    const problems = await findLedgerProblems(prisma)
    expect(problems).toHaveLength(2)
    expect(problems.join("\n")).toContain("total_available 120")
    expect(problems.join("\n")).toContain("total_used 10")
  })
})
