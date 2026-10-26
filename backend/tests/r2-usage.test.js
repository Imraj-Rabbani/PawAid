import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import app from "../src/app.js"
import env from "../src/config/env.js"
import { prisma } from "../src/db.js"
import { checkR2Usage, isR2UploadBlocked, resetR2Guard } from "../src/services/r2Usage.services.js"
import { createUser } from "./helpers.js"

const NOW = new Date("2026-10-26T12:00:00Z")

// stands in for Cloudflare's analytics API and Resend; `usage` is what Cloudflare reports
function fakeServices(usage) {
  const emails = []
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (url.startsWith("https://api.resend.com")) {
      emails.push(JSON.parse(options.body))
      return Response.json({ id: "email-id" })
    }
    if (usage instanceof Error) return Response.json({ errors: [{ message: usage.message }] }, { status: 401 })
    return Response.json({
      data: {
        viewer: {
          accounts: [{
            r2OperationsAdaptiveGroups: [
              { sum: { requests: usage.puts ?? 0 }, dimensions: { actionType: "PutObject" } },
              { sum: { requests: usage.gets ?? 0 }, dimensions: { actionType: "GetObject" } },
              // free, never counted
              { sum: { requests: 5_000_000 }, dimensions: { actionType: "DeleteObject" } },
            ],
            // newest first; only the latest row per bucket counts
            r2StorageAdaptiveGroups: [
              { max: { payloadSize: usage.bytes ?? 0, metadataSize: 0 }, dimensions: { bucketName: "pawaid" } },
              { max: { payloadSize: 9e9, metadataSize: 0 }, dimensions: { bucketName: "pawaid" } },
            ],
          }],
        },
      },
    })
  }))
  return emails
}

describe("R2 free tier guard", () => {
  beforeEach(() => {
    Object.assign(env, { CLOUDFLARE_API_TOKEN: "test-token", R2_ACCOUNT_ID: "test-account", RESEND_API_KEY: "re_test", ALERT_EMAIL: "me@test.local" })
    resetR2Guard()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    resetR2Guard()
  })

  it("does nothing while usage is low", async () => {
    const emails = fakeServices({ bytes: 1e9, puts: 1000, gets: 10_000 })
    await checkR2Usage(NOW)

    expect(isR2UploadBlocked()).toBe(false)
    expect(emails).toEqual([])
  })

  it("warns once at 80% without blocking", async () => {
    const emails = fakeServices({ bytes: 8.5e9 })
    await checkR2Usage(NOW)
    await checkR2Usage(NOW)

    expect(isR2UploadBlocked()).toBe(false)
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe("me@test.local")
    expect(emails[0].subject).toMatch(/Storage at 85%/)
  })

  it("blocks uploads at 90% and refuses them with 503", async () => {
    const emails = fakeServices({ puts: 950_000 })
    await checkR2Usage(NOW)

    expect(isR2UploadBlocked()).toBe(true)
    expect(emails).toHaveLength(1)
    expect(emails[0].text).toMatch(/uploads are paused/i)

    const user = await createUser()
    const res = await request(app).put("/api/users/profile-picture")
      .set("Authorization", `Bearer ${user.token}`)
      .attach("profilePicture", Buffer.from([0xff, 0xd8, 0xff, 0x00]), { filename: "a.jpg", contentType: "image/jpeg" })
    expect(res.status).toBe(503)
  })

  it("emails but doesn't block uploads when only reads are high", async () => {
    const emails = fakeServices({ gets: 9_500_000 })
    await checkR2Usage(NOW)

    expect(isR2UploadBlocked()).toBe(false)
    expect(emails[0].text).toMatch(/public URL/)
  })

  it("unblocks when a new month starts", async () => {
    fakeServices({ bytes: 9.5e9 })
    await checkR2Usage(NOW)
    expect(isR2UploadBlocked()).toBe(true)

    fakeServices({ bytes: 1e9 })
    await checkR2Usage(new Date("2026-11-01T00:15:00Z"))
    expect(isR2UploadBlocked()).toBe(false)
  })

  it("keeps the last state and emails once a day when Cloudflare can't be reached", async () => {
    fakeServices({ bytes: 9.5e9 })
    await checkR2Usage(NOW)

    const emails = fakeServices(new Error("Invalid token"))
    await checkR2Usage(NOW)
    await checkR2Usage(NOW)

    expect(isR2UploadBlocked()).toBe(true)
    expect(emails).toHaveLength(1)
    expect(emails[0].subject).toMatch(/check is failing/)
  })

  it("tries the email again next check if sending failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })))
    vi.spyOn(console, "error").mockImplementation(() => {})
    await checkR2Usage(NOW)

    expect(await prisma.usageAlert.count()).toBe(0)
  })
})
