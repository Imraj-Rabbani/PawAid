import request from "supertest"
import { describe, expect, it } from "vitest"
import app from "../src/app.js"
import { prisma } from "../src/db.js"
import { PAWAID_FUND_ID } from "../src/services/fund.services.js"
import {
  balanceOf, createPost, createUser, createVolunteer, expectLedgerConsistent, post, seedFund, topUp, whileRowLocked,
} from "./helpers.js"

// Several requests that together spend more than is there. whileRowLocked holds
// them at the contested row until all have passed the controllers' up front
// balance check, so only the atomic check inside the transaction (debitWallet,
// debitFund, the claim in assignPost) can stop them overspending.

const ATTEMPTS = 5

const times = (n, fn) => Array.from({ length: n }, fn)
const statuses = (responses) => responses.map((r) => r.status).sort()

describe("concurrent spending", () => {
  it("lets only one of several donations through when the wallet can cover one", async () => {
    const donor = await createUser()
    const volunteer = await createVolunteer()
    await topUp(donor, 100)

    const responses = await whileRowLocked({ table: "wallets", id: donor.wallet.id, waiters: ATTEMPTS }, () =>
      Promise.all(times(ATTEMPTS, () =>
        post(`/donations/volunteer/${volunteer.volunteer.id}`, { token: donor.token, body: { amount: 60 } }),
      )),
    )

    expect(statuses(responses)).toEqual([201, 400, 400, 400, 400])
    expect(await balanceOf(donor)).toBe(40)
    expect(await balanceOf(volunteer)).toBe(60)
    // the rejected ones rolled back their payment, donation and ledger rows too
    expect(await prisma.donation.count()).toBe(1)
    expect(await prisma.financialTransaction.count({ where: { type: "DONATION" } })).toBe(1)
    expect(await prisma.payment.count({ where: { method: "WALLET" } })).toBe(1)
    await expectLedgerConsistent()
  })

  it("lets only one of several rescue post donations through", async () => {
    const donor = await createUser()
    const creator = await createUser()
    const rescue = await createPost({ creator })
    await topUp(donor, 100)

    const responses = await whileRowLocked({ table: "wallets", id: donor.wallet.id, waiters: ATTEMPTS }, () =>
      Promise.all(times(ATTEMPTS, () =>
        post(`/donations/rescue-post/${rescue.id}`, { token: donor.token, body: { amount: 60 } }),
      )),
    )

    expect(statuses(responses)).toEqual([201, 400, 400, 400, 400])
    expect(await balanceOf(donor)).toBe(40)
    // the post's total was incremented inside each transaction, so the rolled back ones undid theirs
    const updated = await prisma.rescuePost.findUnique({ where: { id: rescue.id } })
    expect(updated.donationReceived).toBe(60)
    await expectLedgerConsistent()
  })

  it("lets only one of several volunteer transfers through", async () => {
    const sender = await createVolunteer()
    const receiver = await createVolunteer()
    await topUp(sender, 100)

    const responses = await whileRowLocked({ table: "wallets", id: sender.wallet.id, waiters: ATTEMPTS }, () =>
      Promise.all(times(ATTEMPTS, () =>
        post("/wallet/transfer", { token: sender.token, body: { volunteerId: receiver.volunteer.id, amount: 60 } }),
      )),
    )

    expect(statuses(responses)).toEqual([201, 400, 400, 400, 400])
    expect(await balanceOf(sender)).toBe(40)
    expect(await balanceOf(receiver)).toBe(60)
    expect(await prisma.financialTransaction.count({ where: { type: "TRANSFER" } })).toBe(1)
    await expectLedgerConsistent()
  })

  it("never lets the PawAid Fund give out more than it holds", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const volunteer = await createVolunteer()
    await seedFund(100)

    const responses = await whileRowLocked({ table: "rescue_funds", id: PAWAID_FUND_ID, waiters: ATTEMPTS }, () =>
      Promise.all(times(ATTEMPTS, () =>
        post("/admin/fund/donations", {
          token: admin.token,
          body: { amount: 60, destinationType: "VOLUNTEER", targetId: volunteer.volunteer.id },
        }),
      )),
    )

    expect(statuses(responses)).toEqual([201, 400, 400, 400, 400])
    const fund = await prisma.rescueFund.findUnique({ where: { id: PAWAID_FUND_ID } })
    expect(fund).toMatchObject({ totalAvailable: 100, totalUsed: 60 })
    expect(await balanceOf(volunteer)).toBe(60)
    // the audit log entry is written in the same transaction, so the rejected ones left none
    expect(await prisma.adminAuditLog.count()).toBe(1)
    await expectLedgerConsistent()
  })

  it("moves a rescue's held donations to exactly one of two volunteers claiming it", async () => {
    const donor = await createUser()
    const creator = await createUser()
    const first = await createVolunteer()
    const second = await createVolunteer()
    const rescue = await createPost({ creator })
    await topUp(donor, 500)

    const donated = await post(`/donations/rescue-post/${rescue.id}`, { token: donor.token, body: { amount: 500 } })
    expect(donated.status).toBe(201)

    const claim = (volunteer) =>
      request(app).post(`/api/rescue-post/${rescue.id}/assign`).set("Authorization", `Bearer ${volunteer.token}`)
    const responses = await whileRowLocked({ table: "rescue_posts", id: rescue.id, waiters: 2 }, () =>
      Promise.all([claim(first), claim(second)]),
    )

    expect(statuses(responses)).toEqual([200, 409])
    expect((await balanceOf(first)) + (await balanceOf(second))).toBe(500)
    expect(await prisma.financialTransaction.count({ where: { type: "TRANSFER", source: "RESCUE_POST" } })).toBe(1)
    await expectLedgerConsistent()
  })
})
