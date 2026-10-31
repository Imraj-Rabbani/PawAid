import request from "supertest"
import { describe, expect, it } from "vitest"
import app from "../src/app.js"
import { createUser, expectLedgerConsistent, newKey } from "./helpers.js"

// The MVP success flow in PRD §43, run start to finish through the API the
// way the frontend uses it: people sign up and stay signed in with the login
// cookie, changes carry X-Requested-With, money routes carry an Idempotency-Key.
// Only the admin is made directly, since there is no way to sign up as one.

const DELIVERY = { name: "Tanvir Ahmed", phone: "01700000000", address: "House 12, Road 5, Dhanmondi, Dhaka" }

// A browser session: the cookie from sign up, sent on every request
async function signUp(name) {
  const credentials = { name, email: `${name.split(" ")[0].toLowerCase()}-${newKey()}@test.local`, password: "correct-horse-1" }
  const res = await request(app).post("/api/signup").send(credentials)
  expect(res.status).toBe(201)
  const cookie = res.headers["set-cookie"][0].split(";")[0]
  return { user: res.body.user, ...browser((req) => req.set("Cookie", cookie)) }
}

function browser(signIn) {
  const send = (method, path, body, { money = false } = {}) => {
    const req = signIn(request(app)[method](`/api${path}`)).set("X-Requested-With", "XMLHttpRequest")
    if (money) req.set("Idempotency-Key", newKey())
    return body === undefined ? req : req.send(body)
  }
  return {
    get: (path) => send("get", path),
    post: (path, body, options) => send("post", path, body, options),
    patch: (path, body) => send("patch", path, body),
  }
}

async function signInAdmin() {
  const admin = await createUser({ role: "ADMIN", name: "Admin" })
  return browser((req) => req.set("Authorization", `Bearer ${admin.token}`))
}

const guest = browser((req) => req)

describe("the MVP success flow (PRD §43)", () => {
  it("moves a donation from donor to rescue to volunteer to marketplace to the PawAid Fund", async () => {
    // Setup the admin does before launch: an area and something to sell
    const admin = await signInAdmin()
    const area = await admin.post("/add-area", { area: "Dhanmondi" })
    expect(area.status).toBe(201)
    const category = await admin.post("/admin/categories", { name: "Medicine" })
    expect(category.status).toBe(201)
    const product = await admin.post("/admin/products", {
      name: "Wound spray", categoryId: category.body.data.id, costPrice: 250, sellingPrice: 400, stockQty: 10,
    })
    expect(product.status).toBe(201)
    const areaId = area.body.data.id
    const productId = product.body.data.id

    // User registers
    const reporter = await signUp("Rina Akter")

    // User creates rescue post
    const created = await reporter.post("/rescue-post", {
      title: "Injured puppy near the lake",
      description: "Hurt back leg, can't walk. Needs a vet today.",
      rescueAreaId: areaId,
      donationTarget: 2000,
    })
    expect(created.status).toBe(201)
    const postId = created.body.data.id

    // Another user sees the post
    const donor = await signUp("Karim Hossain")
    const feed = await donor.get("/rescue-post")
    expect(feed.status).toBe(200)
    expect(feed.body.data.map((p) => p.id)).toContain(postId)

    // User tops up their wallet and donates
    expect((await donor.post("/wallet/top-up", { amount: 1500 }, { money: true })).status).toBe(200)
    const donation = await donor.post(`/donations/rescue-post/${postId}`, { amount: 1000 }, { money: true })
    expect(donation.status).toBe(201)
    expect((await donor.get("/wallet/me")).body.data.balance).toBe(500)

    // Donation remains unassigned: held on the post until a volunteer takes it
    const waiting = await guest.get(`/rescue-post/${postId}`)
    expect(waiting.body.data).toMatchObject({ status: "OPEN", assignedVolunteerId: null, donationReceived: 1000 })
    const before = (await guest.get("/transparency")).body.data
    expect(before.volunteers.heldForUnassignedRescues).toBe(1000)

    // Volunteer assigns themselves
    const volunteer = await signUp("Tanvir Ahmed")
    const applied = await volunteer.post("/volunteer/apply", { rescueAreaId: areaId, nid: "1234567890" })
    expect(applied.status).toBe(201)
    const claimed = await volunteer.post(`/rescue-post/${postId}/assign`)
    expect(claimed.status).toBe(200)
    expect(claimed.body.data).toMatchObject({ status: "ASSIGNED", assignedVolunteerId: applied.body.id })

    // Donation moves to volunteer wallet
    expect((await volunteer.get("/wallet/me")).body.data.balance).toBe(1000)

    // Volunteer purchases medicine with their wallet
    const order = await volunteer.post("/orders", {
      items: [{ productId, quantity: 2 }], paymentMethod: "WALLET", delivery: DELIVERY, expectedTotal: 800,
    }, { money: true })
    expect(order.status).toBe(201)
    const orderId = order.body.data.id

    // Wallet balance decreases
    expect((await volunteer.get("/wallet/me")).body.data.balance).toBe(200)

    // Order is created
    const placed = await volunteer.get(`/orders/${orderId}`)
    expect(placed.body.data).toMatchObject({ totalAmount: 800, paymentMethod: "WALLET", status: "CONFIRMED" })

    // Admin marks the order Delivered, one step at a time
    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      expect((await admin.patch(`/admin/orders/${orderId}/status`, { status })).status).toBe(200)
    }

    // Marketplace profit is calculated, and goes into the PawAid Fund:
    // (400 − 250) × 2 = 300. Users can view the updated financial overview.
    const overview = await guest.get("/transparency")
    expect(overview.status).toBe(200)
    expect(overview.body.data).toMatchObject({
      walletTopUps: 1500,
      donations: { total: 1000, count: 1, donors: 1, toRescues: 1000, toVolunteers: 0 },
      volunteers: { active: 1, fundsHeld: 200, movedFromRescues: 1000, heldForUnassignedRescues: 0 },
      rescues: { total: 1, awaitingVolunteer: 0, inProgress: 1, funded: 1 },
      marketplace: { revenue: 800, profit: 300, deliveredOrders: 1 },
      pawaidFund: { received: 300, donated: 0, balance: 300 },
    })

    // The public donations page names the donor (PRD §10)
    const donations = await guest.get("/donations")
    expect(donations.body.data).toHaveLength(1)
    expect(donations.body.data[0]).toMatchObject({ amount: 1000, donor: { name: "Karim Hossain" }, rescuePost: { id: postId } })

    // Every balance on the way is backed by its ledger rows
    await expectLedgerConsistent()
  })
})
