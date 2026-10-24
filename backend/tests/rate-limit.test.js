import request from "supertest"
import { describe, expect, it } from "vitest"
import app from "../src/app.js"
import { createUser, post } from "./helpers.js"

const signup = (n) => request(app).post("/api/signup")
  .send({ name: "New Person", email: `person${n}@test.local`, password: "correct-horse-1" })
const signin = (email, password) => request(app).post("/api/signin").send({ email, password })

describe("rate limits", () => {
  it("caps sign ups from one IP", async () => {
    for (let n = 0; n < 5; n++) expect((await signup(n)).status).toBe(201)

    const res = await signup(5)
    expect(res.status).toBe(429)
    expect(res.body.message).toMatch(/too many/i)
  })

  it("locks an account after repeated wrong passwords, whatever the case of the email", async () => {
    await signup("locked")
    for (let n = 0; n < 5; n++) expect((await signin("personlocked@test.local", "wrong-password")).status).toBe(400)

    // even the right password is refused until the window passes
    expect((await signin("PersonLocked@test.local", "correct-horse-1")).status).toBe(429)
  })

  it("does not count successful sign ins against the account", async () => {
    await signup("ok")
    for (let n = 0; n < 6; n++) expect((await signin("personok@test.local", "correct-horse-1")).status).toBe(200)
  })

  it("caps money requests per user, not for everyone", async () => {
    const user = await createUser()
    const other = await createUser()
    for (let n = 0; n < 20; n++) {
      expect((await post("/wallet/top-up", { token: user.token, body: { amount: 1 } })).status).toBe(200)
    }

    expect((await post("/wallet/top-up", { token: user.token, body: { amount: 1 } })).status).toBe(429)
    expect((await post("/wallet/top-up", { token: other.token, body: { amount: 1 } })).status).toBe(200)
  })
})
