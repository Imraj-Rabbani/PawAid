import crypto from "node:crypto"
import request from "supertest"
import { expect } from "vitest"
import app from "../src/app.js"
import { prisma } from "../src/db.js"
import { generateToken } from "../src/modules/auth/auth.utils.js"
import { creditFund, PAWAID_FUND_ID } from "../src/services/fund.services.js"
import { findLedgerProblems } from "../src/services/ledger.services.js"


// Empties every table except the migration history, and zeroes the PawAid Fund
// row the migrations created. TRUNCATE doesn't fire the audit log's append-only
// trigger, which only guards UPDATE and DELETE.
export async function resetDatabase() {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'rescue_funds')
  `
  const list = tables.map((t) => `"${t.tablename}"`).join(", ")
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`)
  await prisma.rescueFund.update({ where: { id: PAWAID_FUND_ID }, data: { totalAvailable: 0, totalUsed: 0 } })
}


export async function expectLedgerConsistent() {
  expect(await findLedgerProblems(prisma)).toEqual([])
}


export const newKey = () => crypto.randomUUID()

// A POST to a money route; sends a fresh Idempotency-Key unless one is given
export function post(path, { token, body, key = newKey() }) {
  const req = request(app).post(`/api${path}`).send(body)
  if (token) req.set("Authorization", `Bearer ${token}`)
  if (key) req.set("Idempotency-Key", key)
  return req
}


let userCount = 0

// A signed in user with an empty wallet. Money only enters through topUp, so
// every balance in a test is backed by ledger rows.
export async function createUser({ role = "USER", name } = {}) {
  userCount += 1
  const user = await prisma.user.create({
    data: {
      name: name ?? `User ${userCount}`,
      email: `user${userCount}-${newKey()}@test.local`,
      // never signed in with; tests use a token directly
      password: "not-a-real-hash",
      role,
      wallet: { create: {} },
    },
    include: { wallet: true },
  })
  return { ...user, token: generateToken({ userId: user.id, email: user.email }) }
}

export async function createVolunteer({ name } = {}) {
  const user = await createUser({ role: "VOLUNTEER", name })
  const area = await prisma.rescueArea.create({ data: { name: `Area ${newKey()}` } })
  const volunteer = await prisma.volunteerProfile.create({
    data: { userId: user.id, rescueAreaId: area.id, status: "ACTIVE" },
  })
  return { ...user, volunteer }
}

export async function createPost({ creator, donationTarget = 10000 }) {
  const area = await prisma.rescueArea.create({ data: { name: `Area ${newKey()}` } })
  return prisma.rescuePost.create({
    data: { creatorId: creator.id, rescueAreaId: area.id, title: "Injured dog", description: "Needs help", donationTarget },
  })
}

export async function topUp(user, amount) {
  const res = await post("/wallet/top-up", { token: user.token, body: { amount } })
  expect(res.status).toBe(200)
}

// Gives the PawAid Fund money the way a delivered order does: a profit ledger row plus the credit
export function seedFund(amount) {
  return prisma.$transaction(async (tx) => {
    await tx.financialTransaction.create({
      data: {
        type: "MARKETPLACE_PROFIT",
        source: "MARKETPLACE",
        destination: "PAWAID_FUND",
        amount,
        rescueFundId: PAWAID_FUND_ID,
        status: "COMPLETED",
        reference: "Test profit",
      },
    })
    await creditFund(tx, amount)
  })
}

// Makes concurrent requests really overlap. Holds a row lock on `table`.`id`,
// starts `run`, waits until `waiters` database sessions are blocked on a lock,
// then lets go. By then every request is past the controller's up front checks
// and inside its transaction, so only the atomic check in the update decides.
export async function whileRowLocked({ table, id, waiters }, run) {
  let release
  const held = new Promise((resolve) => { release = resolve })
  let lockTaken
  const locked = new Promise((resolve) => { lockTaken = resolve })

  const holder = prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT 1 FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, id)
    lockTaken()
    await held
  }, { timeout: 30000 })

  await locked
  const pending = run()

  const deadline = Date.now() + 10000
  for (;;) {
    const [{ count }] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    `
    if (count >= waiters) break
    if (Date.now() > deadline) {
      release()
      throw new Error(`Only ${count} of ${waiters} requests reached the lock`)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  release()
  await holder
  return pending
}

export async function balanceOf(user) {
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
  return wallet.balance
}
