import crypto from "node:crypto"
import { prisma } from "../db.js"


// Duplicate-payment protection (PRD §39). Use after requireAuth on any route that
// moves money. The client sends an Idempotency-Key header, the same one for every
// attempt at the same payment (a double click, a retry after a timeout):
//   - first time: the request runs, and a successful response is saved
//   - again, after it succeeded: the saved response comes back, nothing is charged twice
//   - again, while the first is still running: 409, so the two can't both go through
//   - again, after it failed: the key was released, so it runs again normally
// A key belongs to one user, one endpoint and one request body.

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,255}$/
// long enough for any sensible retry; expired keys are cleared by cleanupIdempotencyKeys
export const KEY_TTL_MS = 24 * 60 * 60 * 1000

const hashBody = (body) => crypto.createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex")

export async function requireIdempotencyKey(req, res, next) {
    try {
        const key = req.get("Idempotency-Key")
        if (!key || !KEY_PATTERN.test(key)) {
            return res.status(400).json({ message: "A valid Idempotency-Key header is required" })
        }

        const userId = req.user.id
        const endpoint = `${req.method} ${req.baseUrl}${req.path}`
        const requestHash = hashBody(req.body)

        let record = null
        // two tries: the second only happens after clearing out an expired key
        for (let attempt = 0; attempt < 2 && !record; attempt++) {
            try {
                // the unique (user, key) index makes this the lock: only one request can create it
                record = await prisma.idempotencyKey.create({
                    data: { userId, key, endpoint, requestHash },
                    select: { id: true },
                })
            } catch (error) {
                if (error.code !== "P2002") throw error

                const existing = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } })
                if (!existing) continue // released in the meantime, take it

                if (Date.now() - existing.createdAt.getTime() > KEY_TTL_MS) {
                    await prisma.idempotencyKey.deleteMany({ where: { id: existing.id } })
                    continue
                }
                if (existing.endpoint !== endpoint || existing.requestHash !== requestHash) {
                    return res.status(422).json({
                        message: "This payment was already sent with different details. Refresh the page and check your wallet before trying again.",
                    })
                }
                if (existing.responseStatus === null) {
                    return res.status(409).json({ message: "This payment is already being processed" })
                }

                res.set("Idempotent-Replayed", "true")
                return res.status(existing.responseStatus).json(existing.responseBody)
            }
        }
        if (!record) {
            return res.status(409).json({ message: "This payment is already being processed" })
        }

        // Save the outcome before the response goes out, so a retry that arrives
        // right after sees it. Only success is kept: the money-moving handlers run
        // in a database transaction, so a failure changed nothing and may be retried.
        const send = res.json.bind(res)
        res.json = (body) => {
            const succeeded = res.statusCode >= 200 && res.statusCode < 300
            const save = succeeded
                ? prisma.idempotencyKey.update({
                    where: { id: record.id },
                    data: { responseStatus: res.statusCode, responseBody: JSON.parse(JSON.stringify(body ?? null)) },
                })
                : prisma.idempotencyKey.deleteMany({ where: { id: record.id } })

            save
                .catch((error) => console.error("Failed to save the idempotency result", error))
                .finally(() => send(body))
            return res
        }

        next()
    } catch (error) {
        next(error)
    }
}


// Forget keys past their lifetime; server.js runs this every hour
export function cleanupIdempotencyKeys() {
    return prisma.idempotencyKey
        .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEY_TTL_MS) } } })
        .catch((error) => console.error("Failed to clean up idempotency keys", error))
}
