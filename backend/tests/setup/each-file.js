import { afterAll, beforeEach } from "vitest"
import { prisma } from "../../src/db.js"
import { resetRateLimits } from "../../src/middleware/rateLimit.middleware.js"
import { resetDatabase } from "../helpers.js"

// the tests wipe every table, so never let them near a real database
const url = new URL(process.env.DATABASE_URL)
if (url.hostname !== "localhost" || url.pathname !== "/pawaid_test") {
  throw new Error(`Refusing to run tests against ${url.hostname}${url.pathname}`)
}

beforeEach(resetDatabase)
beforeEach(resetRateLimits)

afterAll(() => prisma.$disconnect())
