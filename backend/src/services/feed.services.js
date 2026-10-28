import z from "zod";
import { prisma } from "../db.js";

// The ranked "For you" feed. Unlike a social feed it doesn't chase engagement:
// it puts in front of people the rescues they are most able to help with, while
// help still matters. Every post gets a score at request time:
//
//   status weight x area boost x (1 + funding boost + log(1 + upvotes + 2 comments + 3 donors))
//   ------------------------------------------------------------------------------------------
//                                (age in hours + 2) ^ GRAVITY
//
// The weights are a starting point; tune them as real posts come in.

const WEIGHTS = {
    // an open rescue nobody has taken on is the most urgent
    unclaimed: 3,
    // a volunteer is on it, money and attention still help
    underWay: 1.5,
    // good news, still worth seeing
    resolved: 0.5,
    closed: 0.25,
    // a rescue in the viewer's own area
    sameArea: 2,
    // still raising money, and the extra push once it is close to its target
    raising: 0.5,
    nearlyFunded: 1,
    nearlyFundedFrom: 0.6,
}

// how fast posts sink with age; higher sinks faster
const GRAVITY = 1.5
// an unclaimed open post stops sinking after this, so it isn't buried while it still needs someone
const UNCLAIMED_MAX_AGE_HOURS = 24
// resolved and in-progress rescues older than this leave the ranked feed (open ones never do)
const MAX_AGE_DAYS = 30
// a cursor older than this starts the feed over instead of paging a stale order
const CURSOR_LIFETIME_MS = 24 * 60 * 60 * 1000

const cursorSchema = z.object({
    asOf: z.iso.datetime(),
    score: z.number().finite(),
    id: z.uuid(),
})

// The cursor fixes "now" at the first page, so every later page scores posts
// against the same moment and continues the same order. A post's score can still
// move between pages if it gets upvotes or comments meanwhile, so the client
// should skip ids it already has.
export function encodeFeedCursor({ asOf, score, id }) {
    return Buffer.from(JSON.stringify({ asOf: asOf.toISOString(), score, id })).toString("base64url")
}

// null for a missing, malformed or expired cursor, which starts from the top
export function decodeFeedCursor(value, now = new Date()) {
    if (typeof value !== "string") return null
    try {
        const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString()))
        if (!parsed.success) return null
        const asOf = new Date(parsed.data.asOf)
        if (asOf > now || now - asOf > CURSOR_LIFETIME_MS) return null
        return { ...parsed.data, asOf }
    } catch {
        return null
    }
}

// The area whose rescues the viewer sees first: the one they picked, else their
// volunteer area. null for guests and anyone without either.
export async function viewerAreaId(user) {
    if (!user) return null
    if (user.areaId) return user.areaId

    const volunteer = await prisma.volunteerProfile.findUnique({
        where: { userId: user.id },
        select: { rescueAreaId: true },
    })
    return volunteer?.rescueAreaId ?? null
}

// One page of the ranked feed as [{ id, score }], best first, plus the cursor
// for the next page (null on the last one).
export async function rankPosts({ areaId = null, cursor = null, limit }) {
    const asOf = cursor?.asOf ?? new Date()
    // created_at is stored as UTC without a time zone, and Postgres ignores the
    // "Z" when casting this to timestamp, so both sides compare as UTC
    const now = asOf.toISOString()

    const rows = await prisma.$queryRaw`
        WITH candidates AS (
            SELECT
                p.id,
                p.status,
                p.assigned_volunteer_id,
                p.rescue_area_id,
                p.donation_target,
                p.donation_received,
                GREATEST(EXTRACT(EPOCH FROM (${now}::timestamp - p.created_at)) / 3600, 0)::float8 AS age_hours,
                (SELECT COUNT(*) FROM post_upvotes v WHERE v.post_id = p.id)::float8 AS upvotes,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::float8 AS comments,
                -- people who gave, as on the post page: the PawAid Fund and refunded donations don't count
                (SELECT COUNT(DISTINCT d.donor_id) FROM donations d JOIN payments pay ON pay.id = d.payment_id
                    WHERE d.rescue_post_id = p.id AND d.donor_id IS NOT NULL AND pay.status <> 'REFUNDED')::float8 AS donors
            FROM rescue_posts p
            JOIN users creator ON creator.id = p.creator_id
            WHERE p.status <> 'CANCELLED'
              AND creator.status = 'ACTIVE'
              -- posted after the first page loaded: picked up on the next refresh instead
              AND p.created_at <= ${now}::timestamp
              AND (p.status = 'OPEN' OR p.created_at > ${now}::timestamp - make_interval(days => ${MAX_AGE_DAYS}::int))
        ),
        scored AS (
            SELECT
                id,
                (
                    CASE
                        WHEN status = 'OPEN' AND assigned_volunteer_id IS NULL THEN ${WEIGHTS.unclaimed}::float8
                        WHEN status IN ('ASSIGNED', 'IN_PROGRESS') THEN ${WEIGHTS.underWay}::float8
                        WHEN status = 'RESOLVED' THEN ${WEIGHTS.resolved}::float8
                        ELSE ${WEIGHTS.closed}::float8
                    END::float8
                    * CASE WHEN rescue_area_id = ${areaId}::uuid THEN ${WEIGHTS.sameArea}::float8 ELSE 1 END::float8
                    * (
                        1
                        + CASE
                            WHEN donation_target > 0 AND donation_received < donation_target
                                 AND status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS') THEN
                                CASE WHEN donation_received::float8 / donation_target >= ${WEIGHTS.nearlyFundedFrom}::float8
                                     THEN ${WEIGHTS.nearlyFunded}::float8 ELSE ${WEIGHTS.raising}::float8 END
                            ELSE 0
                          END::float8
                        + LN(1 + upvotes + 2 * comments + 3 * donors)
                    )
                ) / POWER(
                    CASE
                        WHEN status = 'OPEN' AND assigned_volunteer_id IS NULL
                            THEN LEAST(age_hours, ${UNCLAIMED_MAX_AGE_HOURS}::float8)
                        ELSE age_hours
                    END + 2,
                    ${GRAVITY}::float8
                ) AS score
            FROM candidates
        )
        SELECT id, score FROM scored
        WHERE ${cursor === null}::boolean
           OR (score, id) < (${cursor?.score ?? 0}::float8, ${cursor?.id ?? null}::uuid)
        ORDER BY score DESC, id DESC
        LIMIT ${limit + 1}::int
    `

    // one extra row tells us whether there is another page
    const hasMore = rows.length > limit
    if (hasMore) rows.pop()

    const last = rows[rows.length - 1]
    return {
        ranked: rows,
        nextCursor: hasMore ? encodeFeedCursor({ asOf, score: last.score, id: last.id }) : null,
    }
}
