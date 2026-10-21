import crypto from "node:crypto"
import { describe, expect, it } from "vitest"
import { prisma } from "../src/db.js"
import { KEY_TTL_MS } from "../src/middleware/idempotency.middleware.js"
import { balanceOf, createUser, createVolunteer, expectLedgerConsistent, newKey, post, topUp } from "./helpers.js"

// One case per rule in the header comment of idempotency.middleware.js

const TOP_UP = "/wallet/top-up"
// what the middleware stores for a top up: the method and full path, and the body's hash
const TOP_UP_ENDPOINT = "POST /api/wallet/top-up"
const hashOf = (body) => crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex")

describe("Idempotency-Key", () => {
  it("is required on money routes", async () => {
    const user = await createUser()

    const missing = await post(TOP_UP, { token: user.token, body: { amount: 100 }, key: null })
    const malformed = await post(TOP_UP, { token: user.token, body: { amount: 100 }, key: "short" })

    expect(missing.status).toBe(400)
    expect(malformed.status).toBe(400)
    expect(await balanceOf(user)).toBe(0)
  })

  it("replays the first response to a retry instead of charging again", async () => {
    const donor = await createUser()
    const volunteer = await createVolunteer()
    await topUp(donor, 500)
    const key = newKey()
    const send = () => post(`/donations/volunteer/${volunteer.volunteer.id}`, { token: donor.token, body: { amount: 200 }, key })

    const first = await send()
    const retry = await send()

    expect(first.status).toBe(201)
    expect(retry.status).toBe(201)
    expect(retry.headers["idempotent-replayed"]).toBe("true")
    expect(retry.body).toEqual(first.body)
    expect(await balanceOf(donor)).toBe(300)
    expect(await prisma.donation.count()).toBe(1)
    await expectLedgerConsistent()
  })

  it("charges once when the same payment is sent twice at the same moment", async () => {
    const user = await createUser()
    const key = newKey()

    const responses = await Promise.all([
      post(TOP_UP, { token: user.token, body: { amount: 100 }, key }),
      post(TOP_UP, { token: user.token, body: { amount: 100 }, key }),
    ])

    // the second either finds the first still running (409) or gets its saved response
    const replayedOrBusy = responses.filter((r) => r.status === 409 || r.headers["idempotent-replayed"] === "true")
    expect(replayedOrBusy).toHaveLength(1)
    expect(await balanceOf(user)).toBe(100)
    await expectLedgerConsistent()
  })

  it("answers 409 while the first attempt is still running", async () => {
    const user = await createUser()
    const key = newKey()
    const body = { amount: 100 }
    // a key with no saved response yet is one whose request hasn't finished
    await prisma.idempotencyKey.create({
      data: { userId: user.id, key, endpoint: TOP_UP_ENDPOINT, requestHash: hashOf(body) },
    })

    const res = await post(TOP_UP, { token: user.token, body, key })

    expect(res.status).toBe(409)
    expect(await balanceOf(user)).toBe(0)
  })

  it("rejects a key reused with different details", async () => {
    const user = await createUser()
    const key = newKey()

    const first = await post(TOP_UP, { token: user.token, body: { amount: 100 }, key })
    const changed = await post(TOP_UP, { token: user.token, body: { amount: 900 }, key })

    expect(first.status).toBe(200)
    expect(changed.status).toBe(422)
    expect(await balanceOf(user)).toBe(100)
  })

  it("rejects a key reused on a different endpoint", async () => {
    const donor = await createUser()
    const volunteer = await createVolunteer()
    const key = newKey()

    const topUpRes = await post(TOP_UP, { token: donor.token, body: { amount: 100 }, key })
    const donation = await post(`/donations/volunteer/${volunteer.volunteer.id}`, { token: donor.token, body: { amount: 100 }, key })

    expect(topUpRes.status).toBe(200)
    expect(donation.status).toBe(422)
    expect(await balanceOf(donor)).toBe(100)
  })

  it("lets a failed payment be retried with the same key", async () => {
    const donor = await createUser()
    const volunteer = await createVolunteer()
    const key = newKey()
    const send = () => post(`/donations/volunteer/${volunteer.volunteer.id}`, { token: donor.token, body: { amount: 200 }, key })

    const failed = await send()
    expect(failed.status).toBe(400)

    await topUp(donor, 200)
    const retried = await send()

    expect(retried.status).toBe(201)
    expect(retried.headers["idempotent-replayed"]).toBeUndefined()
    expect(await balanceOf(donor)).toBe(0)
    expect(await balanceOf(volunteer)).toBe(200)
    await expectLedgerConsistent()
  })

  it("runs the request again once the key has expired", async () => {
    const user = await createUser()
    const key = newKey()
    const body = { amount: 100 }
    await prisma.idempotencyKey.create({
      data: {
        userId: user.id,
        key,
        endpoint: TOP_UP_ENDPOINT,
        requestHash: hashOf(body),
        responseStatus: 200,
        responseBody: { message: "stale" },
        createdAt: new Date(Date.now() - KEY_TTL_MS - 60000),
      },
    })

    const res = await post(TOP_UP, { token: user.token, body, key })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Wallet topped up")
    expect(await balanceOf(user)).toBe(100)
  })

  it("belongs to one user, so two users can use the same key", async () => {
    const alice = await createUser()
    const bob = await createUser()
    const key = newKey()

    const a = await post(TOP_UP, { token: alice.token, body: { amount: 100 }, key })
    const b = await post(TOP_UP, { token: bob.token, body: { amount: 100 }, key })

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(b.headers["idempotent-replayed"]).toBeUndefined()
    expect(await balanceOf(alice)).toBe(100)
    expect(await balanceOf(bob)).toBe(100)
  })
})
