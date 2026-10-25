import { OAuth2Client } from "google-auth-library"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import app from "../src/app.js"
import { prisma } from "../src/db.js"

// stands in for Google: a credential is "valid" when the spy returns a payload
const verifyIdToken = vi.spyOn(OAuth2Client.prototype, "verifyIdToken")


const profile = { sub: "google-123", email: "Dog.Lover@Gmail.com", email_verified: true, name: "Dog Lover" }
const googleSignIn = () => request(app).post("/api/signin/google").send({ credential: "a-google-id-token" })

beforeEach(() => {
  verifyIdToken.mockReset()
  verifyIdToken.mockResolvedValue({ getPayload: () => profile })
})

describe("signing in with Google", () => {
  it("creates an account with a wallet on first sign-in", async () => {
    const res = await googleSignIn()

    expect(res.status).toBe(200)
    expect(res.headers["set-cookie"][0]).toMatch(/^token=.+; .*HttpOnly/)
    expect(res.body.user).toMatchObject({ name: "Dog Lover", email: "dog.lover@gmail.com" })
    expect(res.body.user).not.toHaveProperty("password")
    expect(res.body.user).not.toHaveProperty("googleId")
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: "a-google-id-token", audience: "test-client-id" })

    const wallet = await prisma.wallet.findUnique({ where: { userId: res.body.user.id } })
    expect(wallet.balance).toBe(0)
  })

  it("signs the same person into the same account next time", async () => {
    const first = await googleSignIn()
    const second = await googleSignIn()

    expect(second.body.user.id).toBe(first.body.user.id)
    expect(await prisma.user.count()).toBe(1)
  })

  it("links to an existing email/password account with the same email", async () => {
    const signup = await request(app).post("/api/signup")
      .send({ name: "Dog Lover", email: "dog.lover@gmail.com", password: "correct-horse-1" })

    const res = await googleSignIn()

    expect(res.body.user.id).toBe(signup.body.user.id)
    const password = await request(app).post("/api/signin")
      .send({ email: "dog.lover@gmail.com", password: "correct-horse-1" })
    expect(password.status).toBe(200)
  })

  it("refuses a credential Google doesn't vouch for", async () => {
    verifyIdToken.mockRejectedValue(new Error("Invalid token signature"))

    const res = await googleSignIn()

    expect(res.status).toBe(401)
    expect(res.headers["set-cookie"]).toBeUndefined()
  })

  it("refuses an unverified email", async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ ...profile, email_verified: false }) })

    const res = await googleSignIn()

    expect(res.status).toBe(400)
    expect(await prisma.user.count()).toBe(0)
  })

  it("refuses a suspended user", async () => {
    const { body } = await googleSignIn()
    await prisma.user.update({ where: { id: body.user.id }, data: { status: "SUSPENDED" } })

    const res = await googleSignIn()

    expect(res.status).toBe(403)
    expect(res.headers["set-cookie"]).toBeUndefined()
  })

  it("tells a Google-only user to use Google instead of a password", async () => {
    await googleSignIn()

    const res = await request(app).post("/api/signin").send({ email: profile.email, password: "anything" })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Google/)
  })
})
