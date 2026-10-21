import request from "supertest"
import { describe, expect, it } from "vitest"
import app from "../src/app.js"
import { prisma } from "../src/db.js"
import { PAWAID_FUND_ID } from "../src/services/fund.services.js"
import {
  balanceOf, createPost, createUser, createVolunteer, expectLedgerConsistent, patch, post, seedFund, topUp,
} from "./helpers.js"

// The donation rows of the flow table in Architecture.md, each followed by a ledger check

const donateToVolunteer = (donor, volunteer, amount) =>
  post(`/donations/volunteer/${volunteer.volunteer.id}`, { token: donor.token, body: { amount } })
const donateToPost = (donor, rescue, amount) =>
  post(`/donations/rescue-post/${rescue.id}`, { token: donor.token, body: { amount } })
const claim = (volunteer, rescue) =>
  request(app).post(`/api/rescue-post/${rescue.id}/assign`).set("Authorization", `Bearer ${volunteer.token}`)
const fundDonation = (admin, body) => post("/admin/fund/donations", { token: admin.token, body })
const setPostStatus = (admin, rescue, status) =>
  patch(`/admin/posts/${rescue.id}/status`, { token: admin.token, body: { status } })

const fund = () => prisma.rescueFund.findUnique({ where: { id: PAWAID_FUND_ID } })
const postTotal = async (rescue) => (await prisma.rescuePost.findUnique({ where: { id: rescue.id } })).donationReceived

describe("wallet top up", () => {
  it("records a completed payment and an INCOME ledger row", async () => {
    const user = await createUser()

    await topUp(user, 250)

    expect(await balanceOf(user)).toBe(250)
    const income = await prisma.financialTransaction.findFirstOrThrow({ where: { type: "INCOME" }, include: { payment: true } })
    expect(income).toMatchObject({ amount: 250, relatedUserId: user.id, status: "COMPLETED" })
    expect(income.payment).toMatchObject({ amount: 250, status: "COMPLETED" })
    await expectLedgerConsistent()
  })
})

describe("donating to a volunteer", () => {
  it("moves the money from the donor's wallet to the volunteer's", async () => {
    const donor = await createUser()
    const volunteer = await createVolunteer()
    await topUp(donor, 300)

    const res = await donateToVolunteer(donor, volunteer, 120)

    expect(res.status).toBe(201)
    expect(await balanceOf(donor)).toBe(180)
    expect(await balanceOf(volunteer)).toBe(120)
    const ledger = await prisma.financialTransaction.findFirstOrThrow({ where: { type: "DONATION" } })
    expect(ledger).toMatchObject({ destination: "VOLUNTEER", relatedVolunteerId: volunteer.volunteer.id, amount: 120 })
    // one ledger row, the donor's debit and the volunteer's credit
    expect(await prisma.walletTransaction.count({ where: { relatedTransactionId: ledger.id } })).toBe(2)
    await expectLedgerConsistent()
  })

  it("refuses a donation to yourself", async () => {
    const volunteer = await createVolunteer()
    await topUp(volunteer, 100)

    const res = await donateToVolunteer(volunteer, volunteer, 50)

    expect(res.status).toBe(400)
    expect(await balanceOf(volunteer)).toBe(100)
  })

  it("refuses a volunteer who isn't active", async () => {
    const donor = await createUser()
    const volunteer = await createVolunteer()
    await prisma.volunteerProfile.update({ where: { id: volunteer.volunteer.id }, data: { status: "SUSPENDED" } })
    await topUp(donor, 100)

    const res = await donateToVolunteer(donor, volunteer, 50)

    expect(res.status).toBe(404)
    expect(await balanceOf(donor)).toBe(100)
  })

  it.each([
    ["zero", 0],
    ["negative", -50],
    ["fractional", 10.5],
    ["text", "100"],
  ])("rejects a %s amount without touching any money", async (_, amount) => {
    const donor = await createUser()
    const volunteer = await createVolunteer()
    await topUp(donor, 100)

    const res = await donateToVolunteer(donor, volunteer, amount)

    expect(res.status).toBe(400)
    expect(await balanceOf(donor)).toBe(100)
    expect(await balanceOf(volunteer)).toBe(0)
    expect(await prisma.donation.count()).toBe(0)
  })
})

describe("donating to a rescue post", () => {
  it("holds the money on the post while no volunteer has it", async () => {
    const donor = await createUser()
    const creator = await createUser()
    const rescue = await createPost({ creator })
    await topUp(donor, 300)

    const res = await donateToPost(donor, rescue, 200)

    expect(res.status).toBe(201)
    expect(await balanceOf(donor)).toBe(100)
    expect(await postTotal(rescue)).toBe(200)
    const ledger = await prisma.financialTransaction.findFirstOrThrow({ where: { type: "DONATION" } })
    expect(ledger).toMatchObject({ destination: "RESCUE_POST", relatedVolunteerId: null })
    // only the donor's debit: nobody's wallet holds the money yet
    expect(await prisma.walletTransaction.count({ where: { relatedTransactionId: ledger.id } })).toBe(1)
    await expectLedgerConsistent()
  })

  it("pays the volunteer straight away once the rescue is assigned", async () => {
    const donor = await createUser()
    const creator = await createUser()
    const volunteer = await createVolunteer()
    const rescue = await createPost({ creator })
    await topUp(donor, 300)
    expect((await claim(volunteer, rescue)).status).toBe(200)

    const res = await donateToPost(donor, rescue, 200)

    expect(res.status).toBe(201)
    expect(await balanceOf(volunteer)).toBe(200)
    expect(await postTotal(rescue)).toBe(200)
    const ledger = await prisma.financialTransaction.findFirstOrThrow({ where: { type: "DONATION" } })
    expect(ledger).toMatchObject({ destination: "VOLUNTEER", relatedVolunteerId: volunteer.volunteer.id })
    await expectLedgerConsistent()
  })

  it("moves the held money to the volunteer who takes the rescue", async () => {
    const donor = await createUser()
    const creator = await createUser()
    const volunteer = await createVolunteer()
    const rescue = await createPost({ creator })
    await topUp(donor, 500)
    await donateToPost(donor, rescue, 200)
    await donateToPost(donor, rescue, 150)

    const res = await claim(volunteer, rescue)

    expect(res.status).toBe(200)
    expect(await balanceOf(volunteer)).toBe(350)
    // the post keeps its total raised; the money now sits in the volunteer's wallet
    expect(await postTotal(rescue)).toBe(350)
    await expectLedgerConsistent()
  })

  it("refuses a donation to your own rescue post", async () => {
    const creator = await createUser()
    const rescue = await createPost({ creator })
    await topUp(creator, 100)

    const res = await donateToPost(creator, rescue, 50)

    expect(res.status).toBe(400)
    expect(await balanceOf(creator)).toBe(100)
  })

  it("refuses a donation to a rescue that is no longer raising money", async () => {
    const donor = await createUser()
    const creator = await createUser()
    const rescue = await createPost({ creator })
    await prisma.rescuePost.update({ where: { id: rescue.id }, data: { status: "CLOSED" } })
    await topUp(donor, 100)

    const res = await donateToPost(donor, rescue, 50)

    expect(res.status).toBe(400)
    expect(await balanceOf(donor)).toBe(100)
    expect(await prisma.payment.count({ where: { method: "WALLET" } })).toBe(0)
    await expectLedgerConsistent()
  })
})

describe("PawAid Fund donations", () => {
  it("pays a volunteer from the fund and logs the admin's action", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const volunteer = await createVolunteer()
    await seedFund(500)

    const res = await fundDonation(admin, { amount: 200, destinationType: "VOLUNTEER", targetId: volunteer.volunteer.id })

    expect(res.status).toBe(201)
    expect(await balanceOf(volunteer)).toBe(200)
    expect(await fund()).toMatchObject({ totalAvailable: 500, totalUsed: 200 })
    const ledger = await prisma.financialTransaction.findFirstOrThrow({ where: { type: "RESCUE_FUND_ALLOCATION" } })
    expect(ledger.relatedUserId).toBe(admin.id)
    expect(await prisma.adminAuditLog.findFirst({ where: { action: "FUND_DONATION" } })).not.toBeNull()
    await expectLedgerConsistent()
  })

  it("refuses more than the fund holds", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const volunteer = await createVolunteer()
    await seedFund(100)

    const res = await fundDonation(admin, { amount: 101, destinationType: "VOLUNTEER", targetId: volunteer.volunteer.id })

    expect(res.status).toBe(400)
    expect(await fund()).toMatchObject({ totalUsed: 0 })
    expect(await balanceOf(volunteer)).toBe(0)
    await expectLedgerConsistent()
  })
})

describe("closing a rescue that never got a volunteer", () => {
  it("refunds every donor and the fund, and drops the refunds from the public totals", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const alice = await createUser()
    const bob = await createUser()
    const creator = await createUser()
    const rescue = await createPost({ creator })
    await topUp(alice, 300)
    await topUp(bob, 300)
    await seedFund(500)
    await donateToPost(alice, rescue, 100)
    await donateToPost(alice, rescue, 50)
    await donateToPost(bob, rescue, 200)
    await fundDonation(admin, { amount: 150, destinationType: "RESCUE_POST", targetId: rescue.id })
    expect(await postTotal(rescue)).toBe(500)
    expect(await fund()).toMatchObject({ totalUsed: 150 })

    const res = await setPostStatus(admin, rescue, "CANCELLED")

    expect(res.status).toBe(200)
    expect(res.body.refund).toEqual({ amount: 500, count: 4 })
    expect(await balanceOf(alice)).toBe(300)
    expect(await balanceOf(bob)).toBe(300)
    expect(await fund()).toMatchObject({ totalAvailable: 500, totalUsed: 0 })
    expect(await postTotal(rescue)).toBe(0)
    expect(await prisma.payment.count({ where: { status: "REFUNDED" } })).toBe(4)
    expect(await prisma.financialTransaction.count({ where: { type: "REFUND" } })).toBe(4)
    // the original rows stay, so the history is kept
    expect(await prisma.donation.count()).toBe(4)

    const transparency = await request(app).get("/api/transparency")
    expect(transparency.body.data.donations).toMatchObject({ total: 0, count: 0, donors: 0 })
    await expectLedgerConsistent()
  })

  it("refunds nothing when a volunteer already has the money", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const donor = await createUser()
    const creator = await createUser()
    const volunteer = await createVolunteer()
    const rescue = await createPost({ creator })
    await topUp(donor, 300)
    await donateToPost(donor, rescue, 200)
    await claim(volunteer, rescue)

    const res = await setPostStatus(admin, rescue, "CLOSED")

    expect(res.status).toBe(200)
    expect(res.body.refund).toEqual({ amount: 0, count: 0 })
    expect(await balanceOf(donor)).toBe(100)
    expect(await balanceOf(volunteer)).toBe(200)
    await expectLedgerConsistent()
  })

  it("doesn't refund twice when the post is closed again", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const donor = await createUser()
    const creator = await createUser()
    const rescue = await createPost({ creator })
    await topUp(donor, 300)
    await donateToPost(donor, rescue, 200)

    await setPostStatus(admin, rescue, "CLOSED")
    const again = await setPostStatus(admin, rescue, "CANCELLED")

    expect(again.status).toBe(200)
    expect(again.body.refund).toEqual({ amount: 0, count: 0 })
    expect(await balanceOf(donor)).toBe(300)
    await expectLedgerConsistent()
  })
})
