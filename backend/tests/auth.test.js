import request from "supertest"
import { describe, expect, it } from "vitest"
import app from "../src/app.js"
import { prisma } from "../src/db.js"
import router from "../src/routes/index.js"
import { generateToken } from "../src/modules/auth/auth.utils.js"
import { startSession } from "../src/modules/auth/auth.services.js"
import { createPost, createUser, createVolunteer, newKey, post, topUp } from "./helpers.js"

// Who may call what. The routes are read from the router, so a new route is
// covered as soon as it is added: it has to sign people in, or be added to
// PUBLIC_ROUTES on purpose.

const PUBLIC_ROUTES = new Set([
  "POST /signup",
  "POST /signin",
  "POST /signin/google",
  "POST /signout",
  "POST /password/forgot",
  "POST /password/reset",
  "GET /home/summary",
  "GET /transparency",
  "GET /marketplace/products",
  "GET /marketplace/products/:productId",
  "GET /marketplace/categories",
  "GET /area",
  "GET /rescue-post",
  "GET /rescue-post/:postId",
  "GET /rescue-post/:postId/comments",
  "GET /rescue-post/:postId/updates",
  "GET /rescue-post/:postId/expenses",
  "GET /volunteer",
  "GET /volunteer/:id",
  "GET /donations",
])

const VOLUNTEER_ROUTES = new Set([
  "POST /rescue-post/:postId/assign",
  "POST /rescue-post/:postId/updates",
  "POST /rescue-post/:postId/expenses",
  "DELETE /expenses/:expenseId",
  "PATCH /rescue-post/:postId/progress",
  "PUT /volunteer/profile",
  "POST /wallet/transfer",
])

const ADMIN_ROUTES_OUTSIDE_ADMIN = new Set(["POST /add-area"])

const routes = router.stack
  .filter((layer) => layer.route)
  .flatMap((layer) => Object.keys(layer.route.methods).map((method) => ({
    method,
    path: layer.route.path,
    name: `${method.toUpperCase()} ${layer.route.path}`,
    middleware: layer.route.stack.map((s) => s.name),
  })))

const isAdminRoute = (route) => route.path.startsWith("/admin") || ADMIN_ROUTES_OUTSIDE_ADMIN.has(route.name)
const protectedRoutes = routes.filter((r) => !PUBLIC_ROUTES.has(r.name))
const adminRoutes = routes.filter(isAdminRoute)
const volunteerRoutes = routes.filter((r) => VOLUNTEER_ROUTES.has(r.name))

// fills path params with an id that matches nothing
const call = (route, token) => {
  const req = request(app)[route.method](`/api${route.path.replace(/:\w+/g, crypto.randomUUID())}`)
  if (token) req.set("Authorization", `Bearer ${token}`)
  return req.set("Idempotency-Key", newKey()).send({})
}

describe("the route lists", () => {
  it("only name routes that exist", () => {
    const names = new Set(routes.map((r) => r.name))
    for (const name of [...PUBLIC_ROUTES, ...VOLUNTEER_ROUTES, ...ADMIN_ROUTES_OUTSIDE_ADMIN]) {
      expect(names, name).toContain(name)
    }
  })

  it("match the middleware each route actually has", () => {
    const withVolunteerCheck = routes.filter((r) => r.middleware.includes("requireActiveVolunteer")).map((r) => r.name)
    expect(withVolunteerCheck.sort()).toEqual([...VOLUNTEER_ROUTES].sort())
  })
})

describe("signing in is required", () => {
  it.each(protectedRoutes.map((r) => [r.name, r]))("%s rejects a guest", async (_, route) => {
    const res = await call(route)
    expect(res.status).toBe(401)
  })

  it.each(protectedRoutes.map((r) => [r.name, r]))("%s rejects a forged token", async (_, route) => {
    const res = await call(route, "not.a.jwt")
    expect(res.status).toBe(401)
  })

  it("rejects a token for a user who no longer exists", async () => {
    const { token } = generateToken({ userId: crypto.randomUUID(), email: "gone@test.local", sessionId: crypto.randomUUID() })
    const res = await request(app).get("/api/wallet/me").set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it("signs out a suspended user, so they can't move money", async () => {
    const user = await createUser()
    await topUp(user, 100)
    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } })

    const res = await post("/wallet/top-up", { token: user.token, body: { amount: 100 } })

    expect(res.status).toBe(401)
  })
})

describe("admin routes", () => {
  it.each(adminRoutes.map((r) => [r.name, r]))("%s is closed to a normal user", async (_, route) => {
    const user = await createUser()
    expect((await call(route, user.token)).status).toBe(403)
  })

  it.each(adminRoutes.map((r) => [r.name, r]))("%s is closed to a volunteer", async (_, route) => {
    const volunteer = await createVolunteer()
    expect((await call(route, volunteer.token)).status).toBe(403)
  })
})

describe("volunteer routes", () => {
  it.each(volunteerRoutes.map((r) => [r.name, r]))("%s is closed to a normal user", async (_, route) => {
    const user = await createUser()
    expect((await call(route, user.token)).status).toBe(403)
  })

  it.each(volunteerRoutes.map((r) => [r.name, r]))("%s is closed to a revoked volunteer", async (_, route) => {
    const volunteer = await createVolunteer()
    await prisma.volunteerProfile.update({ where: { id: volunteer.volunteer.id }, data: { status: "SUSPENDED" } })
    expect((await call(route, volunteer.token)).status).toBe(403)
  })
})

describe("profiles", () => {
  const profile = (viewer, user) =>
    request(app).get(`/api/profile/${user.id}`).set("Authorization", `Bearer ${viewer.token}`)

  it("shows the owner their own contact details and wallet", async () => {
    const user = await createVolunteer()
    await prisma.volunteerProfile.update({ where: { id: user.volunteer.id }, data: { nid: "1234567890" } })

    const res = await profile(user, user)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ email: user.email, wallet: { balance: 0 }, volunteerProfile: { nid: "1234567890" } })
    expect(res.body.password).toBeUndefined()
  })

  it("hides contact details, wallet and NID from other users", async () => {
    const user = await createVolunteer()
    await prisma.user.update({ where: { id: user.id }, data: { phone: "01700000000", address: "Dhaka" } })
    await prisma.volunteerProfile.update({ where: { id: user.volunteer.id }, data: { nid: "1234567890" } })
    const stranger = await createUser()

    const res = await profile(stranger, user)

    expect(res.status).toBe(200)
    expect(res.body.name).toBe(user.name)
    for (const field of ["email", "phone", "address", "wallet", "password"]) {
      expect(res.body, field).not.toHaveProperty(field)
    }
    expect(res.body.volunteerProfile).not.toHaveProperty("nid")
  })

  it("shows an admin everything but the password", async () => {
    const user = await createUser()
    const admin = await createUser({ role: "ADMIN" })

    const res = await profile(admin, user)

    expect(res.body).toMatchObject({ email: user.email, wallet: { balance: 0 } })
    expect(res.body.password).toBeUndefined()
  })
})

describe("signing up and in", () => {
  const credentials = { name: "New Person", email: "New.Person@Test.local", password: "correct-horse-1" }

  it("never returns the password hash", async () => {
    const signup = await request(app).post("/api/signup").send(credentials)
    const signin = await request(app).post("/api/signin").send({ email: credentials.email, password: credentials.password })

    expect(signup.status).toBe(201)
    expect(signin.status).toBe(200)
    expect(signup.body.user).not.toHaveProperty("password")
    expect(signin.body.user).not.toHaveProperty("password")
    // the token only travels in the httpOnly cookie, never where page scripts can read it
    expect(signin.body).not.toHaveProperty("token")
    expect(signin.headers["set-cookie"][0]).toMatch(/^token=.+; .*HttpOnly/)
  })

  it("gives every new user an empty wallet", async () => {
    const res = await request(app).post("/api/signup").send(credentials)
    const wallet = await prisma.wallet.findUnique({ where: { userId: res.body.user.id } })
    expect(wallet.balance).toBe(0)
  })

  it("refuses a second account with the same email in another case", async () => {
    await request(app).post("/api/signup").send(credentials)
    const res = await request(app).post("/api/signup").send({ ...credentials, email: credentials.email.toUpperCase() })
    expect(res.status).toBe(409)
  })

  it("refuses a wrong password", async () => {
    await request(app).post("/api/signup").send(credentials)
    const res = await request(app).post("/api/signin").send({ email: credentials.email, password: "wrong-password" })
    expect(res.status).toBe(400)
    expect(res.headers["set-cookie"]).toBeUndefined()
  })

  it("gives the same answer for an unknown email as for a wrong password", async () => {
    await request(app).post("/api/signup").send(credentials)
    const wrongPassword = await request(app).post("/api/signin").send({ email: credentials.email, password: "wrong-password" })
    const unknownEmail = await request(app).post("/api/signin").send({ email: "nobody@test.local", password: "wrong-password" })

    expect(unknownEmail.status).toBe(wrongPassword.status)
    expect(unknownEmail.body).toEqual(wrongPassword.body)
    expect(unknownEmail.body.message).toBe("Invalid email or password")
  })

  it("refuses a suspended user", async () => {
    const { body } = await request(app).post("/api/signup").send(credentials)
    await prisma.user.update({ where: { id: body.user.id }, data: { status: "SUSPENDED" } })

    const res = await request(app).post("/api/signin").send({ email: credentials.email, password: credentials.password })

    expect(res.status).toBe(403)
    expect(res.headers["set-cookie"]).toBeUndefined()
  })
})

describe("the login cookie", () => {
  const credentials = { name: "Cookie Person", email: "cookie.person@test.local", password: "correct-horse-1" }
  const signIn = async () => {
    await request(app).post("/api/signup").send(credentials)
    const res = await request(app).post("/api/signin").send({ email: credentials.email, password: credentials.password })
    return res.headers["set-cookie"][0].split(";")[0]
  }

  it("signs requests in", async () => {
    const cookie = await signIn()
    const res = await request(app).get("/api/wallet/me").set("Cookie", cookie)
    expect(res.status).toBe(200)
  })

  it("is refused on a change without the X-Requested-With header another site can't send", async () => {
    const cookie = await signIn()
    const res = await request(app).post("/api/signout").set("Cookie", cookie)
    expect(res.status).toBe(403)
  })

  it("is cleared on sign out", async () => {
    const cookie = await signIn()
    const res = await request(app).post("/api/signout").set("Cookie", cookie).set("X-Requested-With", "XMLHttpRequest")
    expect(res.status).toBe(200)
    expect(res.headers["set-cookie"][0]).toMatch(/^token=;.*Expires=Thu, 01 Jan 1970/)
  })
})

describe("security headers", () => {
  it("are set on API responses", async () => {
    const res = await request(app).get("/api/transparency")
    expect(res.headers["x-content-type-options"]).toBe("nosniff")
    expect(res.headers["strict-transport-security"]).toBeDefined()
    expect(res.headers["content-security-policy"]).toBeDefined()
    expect(res.headers["x-powered-by"]).toBeUndefined()
  })
})

describe("ending sessions on the server", () => {
  // a copied token, e.g. stolen before sign out
  const asToken = (token) => request(app).get("/api/wallet/me").set("Authorization", `Bearer ${token}`)

  it("stops a copied token working once its session signs out", async () => {
    const user = await createUser()

    await request(app).post("/api/signout").set("Authorization", `Bearer ${user.token}`)

    expect((await asToken(user.token)).status).toBe(401)
  })

  it("leaves the user's other sessions signed in on a normal sign out", async () => {
    const user = await createUser()
    const { token: laptop } = await startSession(user)

    await request(app).post("/api/signout").set("Authorization", `Bearer ${user.token}`)

    expect((await asToken(laptop)).status).toBe(200)
  })

  it("signs out every device on sign out everywhere", async () => {
    const user = await createUser()
    const { token: laptop } = await startSession(user)

    const res = await request(app).post("/api/signout/all").set("Authorization", `Bearer ${user.token}`)

    expect(res.status).toBe(200)
    expect((await asToken(user.token)).status).toBe(401)
    expect((await asToken(laptop)).status).toBe(401)
  })

  it("keeps a suspended user signed out after they are reactivated", async () => {
    const admin = await createUser({ role: "ADMIN" })
    const user = await createUser()
    const setStatus = (status) => request(app).patch(`/api/admin/users/${user.id}/status`)
      .set("Authorization", `Bearer ${admin.token}`).send({ status })

    expect((await setStatus("SUSPENDED")).status).toBe(200)
    expect((await setStatus("ACTIVE")).status).toBe(200)

    expect((await asToken(user.token)).status).toBe(401)
  })

  it("rejects a validly signed token that names no session", async () => {
    const user = await createUser()
    const { token } = generateToken({ userId: user.id, email: user.email })

    expect((await asToken(token)).status).toBe(401)
  })
})

describe("deleting a rescue post", () => {
  const remove = (user, rescue) =>
    request(app).delete(`/api/rescue-post/${rescue.id}`).set("Authorization", `Bearer ${user.token}`)
  const exists = async (rescue) => Boolean(await prisma.rescuePost.findUnique({ where: { id: rescue.id } }))

  it("lets the creator delete a post nobody has donated to", async () => {
    const creator = await createUser()
    const rescue = await createPost({ creator })

    const res = await remove(creator, rescue)

    expect(res.status).toBe(200)
    expect(await exists(rescue)).toBe(false)
  })

  it("keeps a post once it has donations, for the financial record", async () => {
    const creator = await createUser()
    const donor = await createUser()
    const rescue = await createPost({ creator })
    await topUp(donor, 100)
    await post(`/donations/rescue-post/${rescue.id}`, { token: donor.token, body: { amount: 50 } })

    const res = await remove(creator, rescue)

    expect(res.status).toBe(409)
    expect(await exists(rescue)).toBe(true)
  })

  it("doesn't let anyone else delete it", async () => {
    const creator = await createUser()
    const stranger = await createUser()
    const rescue = await createPost({ creator })

    const res = await remove(stranger, rescue)

    expect(res.status).toBe(403)
    expect(await exists(rescue)).toBe(true)
  })
})
