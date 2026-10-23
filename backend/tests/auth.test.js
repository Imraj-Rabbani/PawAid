import request from "supertest"
import { describe, expect, it } from "vitest"
import app from "../src/app.js"
import { prisma } from "../src/db.js"
import router from "../src/routes/index.js"
import { generateToken } from "../src/modules/auth/auth.utils.js"
import { createPost, createUser, createVolunteer, newKey, post, topUp } from "./helpers.js"

// Who may call what. The routes are read from the router, so a new route is
// covered as soon as it is added: it has to sign people in, or be added to
// PUBLIC_ROUTES on purpose.

const PUBLIC_ROUTES = new Set([
  "POST /signup",
  "POST /signin",
  "POST /signin/google",
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
    const token = generateToken({ userId: crypto.randomUUID(), email: "gone@test.local" })
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
    expect(signin.body.token).toEqual(expect.any(String))
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
    expect(res.body.token).toBeUndefined()
  })

  it("refuses a suspended user", async () => {
    const { body } = await request(app).post("/api/signup").send(credentials)
    await prisma.user.update({ where: { id: body.user.id }, data: { status: "SUSPENDED" } })

    const res = await request(app).post("/api/signin").send({ email: credentials.email, password: credentials.password })

    expect(res.status).toBe(403)
    expect(res.body.token).toBeUndefined()
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
