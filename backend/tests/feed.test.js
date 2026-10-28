import request from "supertest"
import { beforeEach, describe, expect, it } from "vitest"
import app from "../src/app.js"
import { prisma } from "../src/db.js"
import { createUser, createVolunteer, newKey } from "./helpers.js"

const HOUR = 60 * 60 * 1000

let creator, areaA, areaB
beforeEach(async () => {
  creator = await createUser()
  areaA = await prisma.rescueArea.create({ data: { name: `Area ${newKey()}` } })
  areaB = await prisma.rescueArea.create({ data: { name: `Area ${newKey()}` } })
})

function makePost({ area = areaA, hoursAgo = 0, by = creator, ...data } = {}) {
  return prisma.rescuePost.create({
    data: {
      creatorId: by.id,
      rescueAreaId: area.id,
      title: "Injured dog",
      description: "Needs help soon",
      createdAt: new Date(Date.now() - hoursAgo * HOUR),
      ...data,
    },
  })
}

function feed({ token, ...query } = {}) {
  const req = request(app).get("/api/rescue-post").query({ sort: "ranked", ...query })
  return token ? req.set("Authorization", `Bearer ${token}`) : req
}

const ids = (res) => res.body.data.map((post) => post.id)

describe("the ranked feed", () => {
  it("puts a rescue that needs a volunteer above a resolved one of the same age", async () => {
    const resolved = await makePost({ hoursAgo: 1, status: "RESOLVED" })
    const open = await makePost({ hoursAgo: 1 })

    expect(ids(await feed())).toEqual([open.id, resolved.id])
  })

  it("stops an unclaimed rescue sinking while it waits for someone", async () => {
    const waiting = await makePost({ hoursAgo: 5 * 24 })
    const resolved = await makePost({ hoursAgo: 2 * 24, status: "RESOLVED" })

    expect(ids(await feed())).toEqual([waiting.id, resolved.id])
  })

  it("puts rescues in the area the viewer picked first", async () => {
    const nearby = await makePost({ area: areaA, hoursAgo: 2 })
    const newer = await makePost({ area: areaB, hoursAgo: 1 })
    const viewer = await createUser()
    await prisma.user.update({ where: { id: viewer.id }, data: { areaId: areaA.id } })

    const guest = await feed()
    expect(ids(guest)).toEqual([newer.id, nearby.id])
    expect(guest.body.personalised).toBe(false)

    const signedIn = await feed({ token: viewer.token })
    expect(ids(signedIn)).toEqual([nearby.id, newer.id])
    expect(signedIn.body.personalised).toBe(true)
  })

  it("uses a volunteer's area when they haven't picked one", async () => {
    const volunteer = await createVolunteer()
    const theirArea = { id: volunteer.volunteer.rescueAreaId }
    const nearby = await makePost({ area: theirArea, hoursAgo: 2 })
    const newer = await makePost({ area: areaB, hoursAgo: 1 })

    expect(ids(await feed({ token: volunteer.token }))).toEqual([nearby.id, newer.id])
  })

  it("lifts posts people engage with", async () => {
    const quiet = await makePost({ hoursAgo: 1 })
    const popular = await makePost({ hoursAgo: 1 })
    for (let n = 0; n < 3; n++) {
      const fan = await createUser()
      await prisma.postUpvote.create({ data: { postId: popular.id, userId: fan.id } })
    }

    expect(ids(await feed())).toEqual([popular.id, quiet.id])
  })

  it("lifts a rescue still raising money, more so when it's nearly there", async () => {
    const noTarget = await makePost({ hoursAgo: 1 })
    const raising = await makePost({ hoursAgo: 1, donationTarget: 1000, donationReceived: 100 })
    const nearlyThere = await makePost({ hoursAgo: 1, donationTarget: 1000, donationReceived: 800 })

    expect(ids(await feed())).toEqual([nearlyThere.id, raising.id, noTarget.id])
  })

  it("leaves out taken down posts and posts by suspended users", async () => {
    const shown = await makePost()
    await makePost({ status: "CANCELLED" })
    const suspended = await createUser()
    await makePost({ by: suspended })
    await prisma.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } })

    expect(ids(await feed())).toEqual([shown.id])
  })

  it("leaves out finished rescues older than a month, but never one still waiting", async () => {
    await makePost({ hoursAgo: 40 * 24, status: "RESOLVED" })
    const waiting = await makePost({ hoursAgo: 40 * 24 })

    expect(ids(await feed())).toEqual([waiting.id])
  })

  it("pages through the same order without repeats", async () => {
    const statuses = ["OPEN", "RESOLVED", "OPEN", "CLOSED", "OPEN", "RESOLVED", "OPEN"]
    for (const [n, status] of statuses.entries()) {
      await makePost({ hoursAgo: n * 7, status, area: n % 2 ? areaA : areaB })
    }
    const all = ids(await feed({ limit: 50 }))

    const paged = []
    let cursor
    do {
      const res = await feed({ limit: 3, cursor })
      paged.push(...ids(res))
      cursor = res.body.nextCursor
    } while (cursor)

    expect(all).toHaveLength(statuses.length)
    expect(paged).toEqual(all)
  })

  it("starts from the top on a cursor it can't read", async () => {
    await makePost()
    await makePost({ hoursAgo: 3 })

    expect(ids(await feed({ cursor: "not-a-cursor" }))).toEqual(ids(await feed()))
  })

  it("keeps the plain feed newest first", async () => {
    const older = await makePost({ hoursAgo: 3 })
    const resolved = await makePost({ hoursAgo: 1, status: "RESOLVED" })

    const res = await request(app).get("/api/rescue-post")
    expect(ids(res)).toEqual([resolved.id, older.id])
  })
})

describe("choosing your area", () => {
  const update = (user, body) =>
    request(app).put("/api/profile/update").set("Authorization", `Bearer ${user.token}`).send(body)

  it("saves and clears the area", async () => {
    const saved = await update(creator, { areaId: areaA.id })
    expect(saved.status).toBe(200)
    expect(saved.body.area).toMatchObject({ id: areaA.id, name: areaA.name })

    const cleared = await update(creator, { areaId: null })
    expect(cleared.body.areaId).toBeNull()
  })

  it("refuses an area that doesn't exist", async () => {
    const res = await update(creator, { areaId: newKey() })
    expect(res.status).toBe(400)
    expect(res.body.errors.areaId).toBeDefined()
  })

  it("keeps it private from other users", async () => {
    await update(creator, { areaId: areaA.id })
    const other = await createUser()

    const own = await request(app).get(`/api/profile/${creator.id}`).set("Authorization", `Bearer ${creator.token}`)
    const theirs = await request(app).get(`/api/profile/${creator.id}`).set("Authorization", `Bearer ${other.token}`)
    expect(own.body.area.id).toBe(areaA.id)
    expect(theirs.body).not.toHaveProperty("area")
    expect(theirs.body).not.toHaveProperty("areaId")
  })
})
