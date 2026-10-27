import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import app from "../src/app.js"
import env from "../src/config/env.js"
import { prisma } from "../src/db.js"

const credentials = { name: "New Person", email: "person@test.local", password: "correct-horse-1" }

const signup = (token) => {
  const req = request(app).post("/api/signup").send(credentials)
  return token ? req.set("X-Captcha-Token", token) : req
}
const signin = (password, token) => {
  const req = request(app).post("/api/signin").send({ email: credentials.email, password })
  return token ? req.set("X-Captcha-Token", token) : req
}

// stands in for Cloudflare: "good-token" is the only one it accepts
let turnstile
beforeEach(() => {
  env.TURNSTILE_SECRET_KEY = "test-turnstile-secret"
  turnstile = vi.fn(async (url, options) => Response.json({ success: JSON.parse(options.body).response === "good-token" }))
  vi.stubGlobal("fetch", turnstile)
})
afterEach(() => {
  env.TURNSTILE_SECRET_KEY = undefined
  vi.unstubAllGlobals()
})

describe("CAPTCHA on sign up and sign in", () => {
  it("refuses a sign up without a token or with a bad one", async () => {
    expect((await signup()).status).toBe(400)
    expect((await signup("bad-token")).status).toBe(400)
    expect(await prisma.user.count()).toBe(0)
  })

  it("signs up and in with a token Cloudflare accepts", async () => {
    expect((await signup("good-token")).status).toBe(201)
    expect((await signin(credentials.password, "good-token")).status).toBe(200)

    const [url, options] = turnstile.mock.calls[0]
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify")
    expect(JSON.parse(options.body)).toMatchObject({ secret: "test-turnstile-secret", response: "good-token" })
  })

  it("refuses a sign in without a solved CAPTCHA, even with the right password", async () => {
    await signup("good-token")

    const res = await signin(credentials.password, "bad-token")
    expect(res.status).toBe(400)
    expect(res.headers["set-cookie"]).toBeUndefined()
  })

  it("doesn't let requests without a solved CAPTCHA lock the account", async () => {
    await signup("good-token")
    for (let n = 0; n < 6; n++) expect((await signin("wrong-password", "bad-token")).status).toBe(400)

    expect((await signin(credentials.password, "good-token")).status).toBe(200)
  })

  it("answers 503 when Cloudflare can't be reached", async () => {
    turnstile.mockRejectedValue(new Error("network down"))

    expect((await signup("good-token")).status).toBe(503)
    expect(await prisma.user.count()).toBe(0)
  })
})
