import bcrypt from "bcryptjs"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import app from "../src/app.js"
import env from "../src/config/env.js"
import { prisma } from "../src/db.js"
import { createUser } from "./helpers.js"

const forgot = (email) => request(app).post("/api/password/forgot").send({ email })
const reset = (token, password = "brand-new-password") => request(app).post("/api/password/reset").send({ token, password })
const signin = (email, password) => request(app).post("/api/signin").send({ email, password })

// stands in for Resend; the emails it would have sent
let emails
beforeEach(() => {
  emails = []
  Object.assign(env, { RESEND_API_KEY: "re_test", APP_URL: "https://pawaid.test" })
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    emails.push(JSON.parse(options.body))
    return Response.json({ id: "email-id" })
  }))
})
afterEach(() => vi.unstubAllGlobals())

// the email goes out after the response, so wait for it
async function resetLinkFor(email) {
  const sentBefore = emails.length
  expect((await forgot(email)).status).toBe(200)
  await vi.waitFor(() => expect(emails.length).toBeGreaterThan(sentBefore))
  const text = emails.at(-1).text
  return text.match(/https:\/\/pawaid\.test\/reset-password#token=([\w-]+)/)[1]
}

async function userWithPassword(password = "old-password-1") {
  const user = await createUser()
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 4) } })
  return user
}

describe("forgot password", () => {
  it("emails a reset link that sets a new password", async () => {
    const user = await userWithPassword()
    const token = await resetLinkFor(user.email)

    const res = await reset(token)
    expect(res.status).toBe(200)

    expect((await signin(user.email, "old-password-1")).status).toBe(400)
    expect((await signin(user.email, "brand-new-password")).status).toBe(200)
  })

  it("answers the same for an unknown email and sends nothing", async () => {
    const user = await userWithPassword()
    const known = await forgot(user.email)
    const unknown = await forgot("nobody@test.local")

    expect(unknown.status).toBe(200)
    expect(unknown.body).toEqual(known.body)
    await vi.waitFor(() => expect(emails).toHaveLength(1))
    expect(emails[0].to).toBe(user.email)
  })

  it("matches the email whatever its case", async () => {
    const user = await userWithPassword()
    await forgot(user.email.toUpperCase())
    await vi.waitFor(() => expect(emails).toHaveLength(1))
  })

  it("sends nothing to a suspended account", async () => {
    const user = await userWithPassword()
    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } })

    await forgot(user.email)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(emails).toEqual([])
  })

  it("stores only a hash of the token", async () => {
    const user = await userWithPassword()
    const token = await resetLinkFor(user.email)

    const row = await prisma.passwordReset.findFirst({ where: { userId: user.id } })
    expect(row.tokenHash).not.toContain(token)
  })

  it("works only once", async () => {
    const user = await userWithPassword()
    const token = await resetLinkFor(user.email)

    expect((await reset(token)).status).toBe(200)
    expect((await reset(token, "another-password")).status).toBe(400)
  })

  it("only lets one of two simultaneous resets through", async () => {
    const user = await userWithPassword()
    const token = await resetLinkFor(user.email)

    const results = await Promise.all([reset(token, "first-password"), reset(token, "second-password")])
    expect(results.map((r) => r.status).sort()).toEqual([200, 400])
  })

  it("only accepts the newest link", async () => {
    const user = await userWithPassword()
    const first = await resetLinkFor(user.email)
    const second = await resetLinkFor(user.email)

    expect((await reset(first)).status).toBe(400)
    expect((await reset(second)).status).toBe(200)
  })

  it("rejects an expired link", async () => {
    const user = await userWithPassword()
    const token = await resetLinkFor(user.email)
    await prisma.passwordReset.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

    expect((await reset(token)).status).toBe(400)
  })

  it("rejects a made up token and a short password", async () => {
    expect((await reset("not-a-real-token")).status).toBe(400)

    const user = await userWithPassword()
    const token = await resetLinkFor(user.email)
    expect((await reset(token, "short")).status).toBe(400)
    // the failed attempt didn't use the link up
    expect((await reset(token)).status).toBe(200)
  })

  it("signs the account out everywhere", async () => {
    const user = await userWithPassword()
    const me = () => request(app).get(`/api/profile/${user.id}`).set("Authorization", `Bearer ${user.token}`)
    expect((await me()).status).toBe(200)

    await reset(await resetLinkFor(user.email))
    expect((await me()).status).toBe(401)
  })

  it("lets a Google-only account add a password", async () => {
    const user = await createUser()
    await prisma.user.update({ where: { id: user.id }, data: { password: null, googleId: "google-123" } })

    await reset(await resetLinkFor(user.email))
    expect((await signin(user.email, "brand-new-password")).status).toBe(200)
  })

  it("caps reset emails to one address", async () => {
    const user = await userWithPassword()
    for (let n = 0; n < 3; n++) expect((await forgot(user.email)).status).toBe(200)
    expect((await forgot(user.email)).status).toBe(429)
  })
})
