import { prisma } from "../db.js"
import env from "../config/env.js"
import { sendEmail } from "./email.services.js"

// Keeps R2 inside the free tier. Every few minutes we ask Cloudflare's analytics API
// how much of this month's allowance the account has used, email a warning when a
// metric passes R2_WARN_PERCENT, and stop accepting uploads past R2_BLOCK_PERCENT.
// Cloudflare has no spending cap for R2, so this is the cap.

// https://developers.cloudflare.com/r2/pricing/ (account wide, per month, Standard storage)
export const FREE_TIER = {
    storage: { label: "Storage", limit: 10e9, format: (n) => `${(n / 1e9).toFixed(2)} GB` },
    classA: { label: "Class A operations (uploads, lists)", limit: 1_000_000, format: (n) => n.toLocaleString("en-US") },
    classB: { label: "Class B operations (image reads)", limit: 10_000_000, format: (n) => n.toLocaleString("en-US") },
}

// uploads add storage and Class A requests, so those are what blocking uploads protects;
// Class B is people viewing images straight from the bucket, which our server never sees
const BLOCKS_UPLOADS = ["storage", "classA"]

// deletes and aborted uploads are free; anything not listed as Class B is billed as Class A
const CLASS_B_ACTIONS = new Set([
    "HeadBucket", "HeadObject", "GetObject", "UsageSummary", "GetBucketEncryption",
    "GetBucketLocation", "GetBucketCors", "GetBucketLifecycleConfiguration",
])
const FREE_ACTIONS = new Set(["DeleteObject", "DeleteBucket", "AbortMultipartUpload"])

const CHECK_INTERVAL = 15 * 60 * 1000

const USAGE_QUERY = `
query R2Usage($accountTag: string!, $start: Time!, $end: Time!) {
    viewer {
        accounts(filter: { accountTag: $accountTag }) {
            r2OperationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }) {
                sum { requests }
                dimensions { actionType }
            }
            r2StorageAdaptiveGroups(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }, orderBy: [datetime_DESC]) {
                max { payloadSize metadataSize }
                dimensions { bucketName datetime }
            }
        }
    }
}`

let uploadsBlocked = false
let lastUsage = null
// the first check after a restart, so uploads wait for it instead of slipping through
let firstCheck = null

export const isR2UploadBlocked = () => uploadsBlocked
export const getLastR2Usage = () => lastUsage

export const isR2GuardEnabled = () => Boolean(env.CLOUDFLARE_API_TOKEN && env.R2_ACCOUNT_ID)

// usage since the start of the current month (UTC), in the units FREE_TIER uses
export async function fetchR2Usage(now = new Date()) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: USAGE_QUERY,
            variables: { accountTag: env.R2_ACCOUNT_ID, start: start.toISOString(), end: now.toISOString() },
        }),
        signal: AbortSignal.timeout(10000),
    })

    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.data || body.errors?.length) {
        throw new Error(`Cloudflare analytics failed (${res.status}): ${JSON.stringify(body?.errors ?? body)}`)
    }

    const account = body.data.viewer.accounts[0]
    if (!account) throw new Error("Cloudflare analytics returned no account, check R2_ACCOUNT_ID and the token's permissions")

    const usage = { storage: 0, classA: 0, classB: 0 }

    for (const row of account.r2OperationsAdaptiveGroups) {
        const action = row.dimensions.actionType
        if (FREE_ACTIONS.has(action)) continue
        usage[CLASS_B_ACTIONS.has(action) ? "classB" : "classA"] += row.sum.requests
    }

    // rows are newest first, so the first one per bucket is its current size
    const seenBuckets = new Set()
    for (const row of account.r2StorageAdaptiveGroups) {
        if (seenBuckets.has(row.dimensions.bucketName)) continue
        seenBuckets.add(row.dimensions.bucketName)
        usage.storage += row.max.payloadSize + row.max.metadataSize
    }

    return usage
}

// Emails once per key: the row goes in first so two servers (or a restart) can't both
// send it, and comes back out if sending fails so the next check tries again.
async function alertOnce(key, subject, text) {
    if (!env.ALERT_EMAIL || !env.RESEND_API_KEY) return

    try {
        await prisma.usageAlert.create({ data: { key } })
    } catch (err) {
        if (err.code === "P2002") return
        throw err
    }

    try {
        await sendEmail({ to: env.ALERT_EMAIL, subject, text })
    } catch (err) {
        await prisma.usageAlert.delete({ where: { key } }).catch(() => {})
        throw err
    }
}

function usageReport(usage) {
    return Object.entries(FREE_TIER).map(([metric, { label, limit, format }]) =>
        `${label}: ${format(usage[metric])} of ${format(limit)} (${Math.round(usage[metric] / limit * 100)}%)`
    ).join("\n")
}

export async function checkR2Usage(now = new Date()) {
    const month = now.toISOString().slice(0, 7)

    let usage
    try {
        usage = await fetchR2Usage(now)
    } catch (err) {
        // keep the last known state rather than unblocking on a failed check
        console.error("R2 usage check failed:", err.message)
        await alertOnce(`${now.toISOString().slice(0, 10)}:check-failed`,
            "PawAid: R2 usage check is failing",
            `The server couldn't read R2 usage from Cloudflare, so it can't tell how close you are to the free tier.\n\n${err.message}`
        ).catch((mailErr) => console.error("Couldn't send R2 alert email:", mailErr.message))
        return
    }

    lastUsage = { ...usage, checkedAt: now }
    const percent = (metric) => usage[metric] / FREE_TIER[metric].limit * 100

    const overBlock = Object.keys(FREE_TIER).filter((metric) => percent(metric) >= env.R2_BLOCK_PERCENT)
    const overWarn = Object.keys(FREE_TIER).filter((metric) => percent(metric) >= env.R2_WARN_PERCENT)

    const wasBlocked = uploadsBlocked
    uploadsBlocked = overBlock.some((metric) => BLOCKS_UPLOADS.includes(metric))
    if (uploadsBlocked && !wasBlocked) console.warn("R2 near the free tier limit, uploads paused")
    if (!uploadsBlocked && wasBlocked) console.warn("R2 back under the limit, uploads resumed")

    const report = usageReport(usage)

    for (const metric of overBlock) {
        const label = FREE_TIER[metric].label
        const action = BLOCKS_UPLOADS.includes(metric)
            ? "Image uploads are paused until usage resets next month. Free up space or raise R2_BLOCK_PERCENT to resume them."
            : "The server can't stop these: they're browsers loading images straight from the bucket. Disable the bucket's public URL in the Cloudflare dashboard (R2 > bucket > Settings) if you need to stop them."
        await alertOnce(`${month}:${metric}:block`,
            `PawAid: R2 ${label} at ${Math.round(percent(metric))}% of the free tier`,
            `${label} has passed ${env.R2_BLOCK_PERCENT}% of the R2 free tier for ${month}.\n\n${action}\n\n${report}`
        ).catch((err) => console.error("Couldn't send R2 alert email:", err.message))
    }

    for (const metric of overWarn.filter((metric) => !overBlock.includes(metric))) {
        const label = FREE_TIER[metric].label
        await alertOnce(`${month}:${metric}:warn`,
            `PawAid: R2 ${label} at ${Math.round(percent(metric))}% of the free tier`,
            `${label} has passed ${env.R2_WARN_PERCENT}% of the R2 free tier for ${month}. ` +
            `Uploads will pause at ${env.R2_BLOCK_PERCENT}%.\n\n${report}`
        ).catch((err) => console.error("Couldn't send R2 alert email:", err.message))
    }
}

export function startR2UsageGuard() {
    if (!isR2GuardEnabled()) {
        console.warn("CLOUDFLARE_API_TOKEN not set, R2 free tier guard is off")
        return
    }
    if (!env.ALERT_EMAIL || !env.RESEND_API_KEY) {
        console.warn("ALERT_EMAIL or RESEND_API_KEY not set, R2 usage alerts won't be emailed")
    }

    firstCheck = checkR2Usage()
    setInterval(checkR2Usage, CHECK_INTERVAL).unref()
}

// goes in front of every upload route, before multer reads the file into memory
export async function requireR2Capacity(req, res, next) {
    await firstCheck
    if (uploadsBlocked) {
        return res.status(503).json({
            message: "Image uploads are paused for now because storage is nearly full. Please try again later.",
        })
    }
    next()
}

// for tests
export function resetR2Guard() {
    uploadsBlocked = false
    lastUsage = null
    firstCheck = null
}
