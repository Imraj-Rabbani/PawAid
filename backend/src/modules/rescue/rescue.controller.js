import z from "zod";
import { prisma } from "../../db.js"
import { uploadToR2 } from "../../services/upload.services.js";
import { creditWallet } from "../../services/wallet.services.js";
import { NOT_REFUNDED } from "../donation/donation.controller.js";
import { PROGRESS_FROM } from "../../schemas/rescue.schemas.js";
import { logAdminAction } from "../../services/audit.services.js";
import { decodeFeedCursor, rankPosts, viewerAreaId } from "../../services/feed.services.js";



const postInclude = {
    creator: {
        select: {
            id: true,
            name: true,
            role: true,
            profilePictureUrl: true,
        },
    },
    rescueArea: true,
    images: true,
    assignedVolunteer: {
        select: {
            id: true,
            user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
    },
    _count: { select: { comments: true, upvotes: true, updates: true, expenses: true } },
};

// Adds the viewer's own upvote (if any) so we can tell them whether they upvoted
function postIncludeFor(userId) {
    return userId
        ? { ...postInclude, upvotes: { where: { userId }, select: { id: true } } }
        : postInclude
}

// Swap the viewer's upvote rows for a simple flag
function withUpvoted({ upvotes, ...post }) {
    return { ...post, upvoted: Boolean(upvotes?.length) }
}


export async function addArea(req, res){
    try {
        const name = req.body.area

        const areaCreated = await prisma.$transaction(async (tx) => {
            const area = await tx.rescueArea.create({ data: { name } })
            await logAdminAction(tx, req.user.id, {
                action: "AREA_CREATED",
                targetType: "RESCUE_AREA",
                targetId: area.id,
                summary: `Added area "${area.name}"`,
                details: { name: area.name },
            })
            return area
        })

        return res.status(201).json({
            message: "Area created",
            data: areaCreated
        })
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({ message: "Area already exists" })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to Create area" });
    }
}

export async function listAreas(req, res){
    try {
        const areas = await prisma.rescueArea.findMany({ orderBy: { name: "asc" } })

        return res.json({
            message: "All Areas Listed",
            data: areas
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch area" });
    }
}

export async function createPost(req, res){
    try {

        const { title, description, rescueAreaId, donationTarget } = req.body

        const area = await prisma.rescueArea.findUnique({ where: { id: rescueAreaId } })
        if (!area) {
            return res.status(400).json({ message: "Invalid rescue area" })
        }

        const userId = req.user.id
        const files = req.files ?? []

        const imageUrls = await Promise.all(files.map((file, index) => {
            const key = `rescue-posts/${userId}-${Date.now()}-${index}.${file.mimetype.split("/")[1]}`
            return uploadToR2(file.buffer, key, file.mimetype)
        }))

        const post = await prisma.rescuePost.create({
            data: {
                creatorId: userId,
                rescueAreaId,
                title,
                description,
                donationTarget: donationTarget ?? 0,
                images: {
                    create: imageUrls.map((imageUrl) => ({ imageUrl })),
                },
            },
            include: postInclude,
        })

        return res.status(201).json({
            message: "Post created",
            data: withUpvoted(post)
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to create post" });
    }
}

// posts an admin took down stay in the database but leave the public feed
const HIDE_REMOVED = { status: { not: "CANCELLED" } };

// Feed tabs on the homepage
const POST_FILTERS = {
    open: { status: "OPEN", assignedVolunteerId: null },
    fundraising: { donationTarget: { gt: 0 }, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } },
    rescued: { status: "RESOLVED" },
};

export async function listPosts(req, res){
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)

        if (req.query.sort === "ranked") return await listRankedPosts(req, res, limit)

        const cursor = z.uuid().safeParse(req.query.cursor)
        const where = Object.hasOwn(POST_FILTERS, req.query.filter) ? POST_FILTERS[req.query.filter] : HIDE_REMOVED

        // newest first, one extra row tells us whether there is another page
        const posts = await prisma.rescuePost.findMany({
            where,
            take: limit + 1,
            ...(cursor.success && { cursor: { id: cursor.data }, skip: 1 }),
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: postIncludeFor(req.user?.id),
        })

        const hasMore = posts.length > limit
        if (hasMore) posts.pop()

        return res.json({
            message: "Posts listed",
            data: posts.map(withUpvoted),
            nextCursor: hasMore ? posts[posts.length - 1].id : null
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch posts" });
    }
}

// The "For you" feed (services/feed.services.js): ranked by urgency, the viewer's
// area, funding need and engagement rather than by date. Filters don't apply here.
async function listRankedPosts(req, res, limit) {
    const areaId = await viewerAreaId(req.user)
    const { ranked, nextCursor } = await rankPosts({ areaId, cursor: decodeFeedCursor(req.query.cursor), limit })

    const posts = await prisma.rescuePost.findMany({
        where: { id: { in: ranked.map((row) => row.id) } },
        include: postIncludeFor(req.user?.id),
    })
    const byId = new Map(posts.map((post) => [post.id, post]))

    return res.json({
        message: "Posts listed",
        // in ranked order; a post deleted since it was ranked is skipped
        data: ranked.map((row) => byId.get(row.id)).filter(Boolean).map(withUpvoted),
        nextCursor,
        // false tells a signed in viewer that picking an area would put nearby rescues first
        personalised: Boolean(areaId),
    })
}

// One rescue for its own page. A taken down post stays visible to its creator
// and admins, the same people who can see it in their lists.
export async function getPost(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            include: postIncludeFor(req.user?.id),
        })
        const canSeeRemoved = post && (post.creatorId === req.user?.id || req.user?.role === "ADMIN")
        if (!post || (post.status === "CANCELLED" && !canSeeRemoved)) {
            return res.status(404).json({ message: "Post not found" })
        }

        // how many people gave, never who they are
        const donors = await prisma.donation.groupBy({
            by: ["donorId"],
            where: { rescuePostId: post.id, donorId: { not: null }, ...NOT_REFUNDED },
        })

        return res.json({ message: "Post found", data: { ...withUpvoted(post), donorCount: donors.length } })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch post" });
    }
}

// The signed in user's rescues for their profile: the posts they created, or (for
// volunteers) the rescues they are handling. Their own taken down posts are included
// so they can see what happened to them.
export async function listMyPosts(req, res){
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)
        const cursor = z.uuid().safeParse(req.query.cursor)
        const userId = req.user.id

        const volunteer = await prisma.volunteerProfile.findUnique({ where: { userId }, select: { id: true } })
        const posted = { creatorId: userId }
        // without a volunteer profile there is nothing to handle
        const handling = volunteer && { assignedVolunteerId: volunteer.id }
        const where = req.query.view === "handling" ? handling : posted

        const [posts, postedCount, handlingCount] = await Promise.all([
            where
                ? prisma.rescuePost.findMany({
                    where,
                    take: limit + 1,
                    ...(cursor.success && { cursor: { id: cursor.data }, skip: 1 }),
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    include: postIncludeFor(userId),
                })
                : [],
            prisma.rescuePost.count({ where: posted }),
            volunteer ? prisma.rescuePost.count({ where: handling }) : 0,
        ])

        const hasMore = posts.length > limit
        if (hasMore) posts.pop()

        return res.json({
            message: "Posts listed",
            data: posts.map(withUpvoted),
            counts: { posted: postedCount, handling: handlingCount },
            nextCursor: hasMore ? posts[posts.length - 1].id : null
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch your rescues" });
    }
}

export async function upvotePost(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            select: { id: true },
        })
        if (!post) {
            return res.status(404).json({ message: "Post not found" })
        }

        // upsert so a double click doesn't fail on the unique pair
        await prisma.postUpvote.upsert({
            where: { postId_userId: { postId: post.id, userId: req.user.id } },
            create: { postId: post.id, userId: req.user.id },
            update: {},
        })

        const upvoteCount = await prisma.postUpvote.count({ where: { postId: post.id } })

        return res.json({
            message: "Post upvoted",
            data: { upvoted: true, upvoteCount }
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to upvote post" });
    }
}

export async function removeUpvote(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        await prisma.postUpvote.deleteMany({
            where: { postId: postId.data, userId: req.user.id },
        })

        const upvoteCount = await prisma.postUpvote.count({ where: { postId: postId.data } })

        return res.json({
            message: "Upvote removed",
            data: { upvoted: false, upvoteCount }
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to remove upvote" });
    }
}

class PostNotAssignableError extends Error {}

// An active volunteer takes responsibility for a rescue. Any donations the post
// collected while unassigned move to their wallet in the same transaction (PRD §9).
export async function assignPost(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const volunteer = req.volunteer

        const wallet = await prisma.wallet.findUnique({ where: { userId: volunteer.userId } })
        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found" })
        }

        const post = await prisma.$transaction(async (tx) => {
            // only an open, unassigned post can be claimed; doing the check in the update
            // means two volunteers racing each other can't both get it
            const { count } = await tx.rescuePost.updateMany({
                where: { id: postId.data, status: "OPEN", assignedVolunteerId: null },
                data: { assignedVolunteerId: volunteer.id, status: "ASSIGNED" },
            })

            if (count === 0) throw new PostNotAssignableError()

            // read after the update, which holds the row lock, so a donation can't slip in between
            const post = await tx.rescuePost.findUnique({
                where: { id: postId.data },
                include: postIncludeFor(req.user.id),
            })

            // the post was never assigned before, so everything it raised is still unassigned
            if (post.donationReceived > 0) {
                const transaction = await tx.financialTransaction.create({
                    data: {
                        type: "TRANSFER",
                        source: "RESCUE_POST",
                        destination: "VOLUNTEER",
                        amount: post.donationReceived,
                        relatedPostId: post.id,
                        relatedVolunteerId: volunteer.id,
                        relatedUserId: volunteer.userId,
                        status: "COMPLETED",
                        reference: "Unassigned rescue funds",
                    },
                })

                await creditWallet(tx, {
                    walletId: wallet.id,
                    amount: post.donationReceived,
                    transactionId: transaction.id,
                    reference: `Donations for ${post.title}`,
                })
            }

            return post
        })

        return res.json({
            message: "Rescue assigned to you",
            data: withUpvoted(post)
        })
    } catch (error) {
        if (error instanceof PostNotAssignableError) {
            const post = await prisma.rescuePost.findUnique({
                where: { id: req.params.postId },
                select: { assignedVolunteerId: true },
            }).catch(() => null)

            if (!post) {
                return res.status(404).json({ message: "Post not found" })
            }
            return res.status(409).json({
                message: post.assignedVolunteerId
                    ? "This rescue already has a volunteer"
                    : "This rescue is no longer open"
            })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to assign rescue" });
    }
}


// Which statuses the assigned volunteer can move a rescue to, and from where


// The assigned volunteer moves their rescue forward: Assigned -> In Progress -> Rescued.
// Marking it rescued can carry a closing note and photo.
export async function updatePostProgress(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }


        const { status, note } = req.body
        const resolving = status === "RESOLVED"

        if (!resolving && (note || req.file)) {
            return res.status(400).json({ message: "A rescue update can only be added when marking it rescued" })
        }

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            select: { id: true, status: true, assignedVolunteerId: true },
        })
        if (!post) {
            return res.status(404).json({ message: "Post not found" })
        }
        if (post.assignedVolunteerId !== req.volunteer.id) {
            return res.status(403).json({ message: "Only the volunteer handling this rescue can update it" })
        }
        if (!PROGRESS_FROM[status].includes(post.status)) {
            return res.status(409).json({ message: "This rescue can't be moved to that status any more" })
        }

        // checked above first so a rejected request doesn't upload anything
        const photoUrl = req.file
            ? await uploadToR2(
                req.file.buffer,
                `rescue-updates/${post.id}-${Date.now()}.${req.file.mimetype.split("/")[1]}`,
                req.file.mimetype
            )
            : undefined

        // the status condition in the update stops two requests racing past the check above
        const { count } = await prisma.rescuePost.updateMany({
            where: { id: post.id, assignedVolunteerId: req.volunteer.id, status: { in: PROGRESS_FROM[status] } },
            data: {
                status,
                ...(resolving && {
                    resolvedAt: new Date(),
                    rescueNote: note || null,
                    rescuePhotoUrl: photoUrl ?? null,
                }),
            },
        })
        if (count === 0) {
            return res.status(409).json({ message: "This rescue can't be moved to that status any more" })
        }

        const updated = await prisma.rescuePost.findUnique({
            where: { id: post.id },
            include: postIncludeFor(req.user.id),
        })

        return res.json({
            message: resolving ? "Rescue marked as rescued" : "Rescue marked in progress",
            data: withUpvoted(updated)
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update rescue" });
    }
}

// ========================================
// RESCUE UPDATES
// ========================================

// the volunteer can keep posting after the rescue too, e.g. how the animal is recovering
const UPDATABLE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "RESOLVED"]


const rescueUpdateSelect = {
    id: true,
    note: true,
    createdAt: true,
    images: { select: { id: true, imageUrl: true } },
    volunteer: { select: { id: true, user: { select: { id: true, name: true, profilePictureUrl: true } } } },
}

// Anyone can follow a rescue's updates, newest first
export async function listRescueUpdates(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)
        const cursor = z.uuid().safeParse(req.query.cursor)

        // one extra row tells us whether there is more
        const updates = await prisma.rescueUpdate.findMany({
            where: { rescuePostId: postId.data },
            take: limit + 1,
            ...(cursor.success && { cursor: { id: cursor.data }, skip: 1 }),
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: rescueUpdateSelect,
        })

        const hasMore = updates.length > limit
        if (hasMore) updates.pop()

        return res.json({
            message: "Updates listed",
            data: updates,
            nextCursor: hasMore ? updates[updates.length - 1].id : null
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch updates" });
    }
}

// The volunteer handling a rescue posts an update: a note, photos, or both
export async function createRescueUpdate(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }


        const { note } = req.body
        const files = req.files ?? []
        if (!note && files.length === 0) {
            return res.status(400).json({ message: "Write an update or add a photo" })
        }

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            select: { id: true, status: true, assignedVolunteerId: true },
        })
        if (!post) {
            return res.status(404).json({ message: "Post not found" })
        }
        if (post.assignedVolunteerId !== req.volunteer.id) {
            return res.status(403).json({ message: "Only the volunteer handling this rescue can post updates" })
        }
        if (!UPDATABLE_STATUSES.includes(post.status)) {
            return res.status(409).json({ message: "This rescue is no longer taking updates" })
        }

        // checked above first so a rejected request doesn't upload anything
        const imageUrls = await Promise.all(files.map((file, index) => uploadToR2(
            file.buffer,
            `rescue-updates/${post.id}-${Date.now()}-${index}.${file.mimetype.split("/")[1]}`,
            file.mimetype
        )))

        const update = await prisma.rescueUpdate.create({
            data: {
                rescuePostId: post.id,
                volunteerId: req.volunteer.id,
                note,
                images: { create: imageUrls.map((imageUrl) => ({ imageUrl })) },
            },
            select: rescueUpdateSelect,
        })

        return res.status(201).json({ message: "Update posted", data: update })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to post update" });
    }
}

// A creator can change or remove their post only while nobody has taken it on
const EDITABLE = { status: "OPEN", assignedVolunteerId: null };

async function explainNotEditable(postId, userId) {
    const post = await prisma.rescuePost.findUnique({
        where: { id: postId },
        select: { creatorId: true },
    })
    if (!post) return [404, "Post not found"]
    if (post.creatorId !== userId) return [403, "You can only change your own posts"]
    return [409, "This rescue has been taken on by a volunteer and can no longer be changed"]
}

export async function updatePost(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }


        const { title, description, rescueAreaId, donationTarget = 0 } = req.body

        const area = await prisma.rescueArea.findUnique({ where: { id: rescueAreaId } })
        if (!area) {
            return res.status(400).json({ message: "Invalid rescue area" })
        }

        const { count } = await prisma.rescuePost.updateMany({
            // the target can't drop below what has already been raised
            where: { id: postId.data, creatorId: req.user.id, ...EDITABLE, donationReceived: { lte: donationTarget } },
            data: { title, description, rescueAreaId, donationTarget },
        })

        if (count === 0) {
            const [code, message] = await explainNotEditable(postId.data, req.user.id)
            if (code === 409) {
                const post = await prisma.rescuePost.findUnique({
                    where: { id: postId.data },
                    select: { donationReceived: true, status: true },
                })
                if (post?.status === "OPEN" && post.donationReceived > donationTarget) {
                    return res.status(400).json({
                        message: "Validation failed",
                        errors: { donationTarget: [`This rescue has already raised ৳${post.donationReceived.toLocaleString()}; the target can't be lower.`] },
                    })
                }
            }
            return res.status(code).json({ message })
        }

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            include: postIncludeFor(req.user.id),
        })

        return res.json({
            message: "Post updated",
            data: withUpvoted(post)
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update post" });
    }
}

// Deleting is only for posts that never received money; once a donation exists the
// post must stay for the financial record (PRD §26)
export async function deletePost(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const { count } = await prisma.rescuePost.deleteMany({
            where: {
                id: postId.data,
                creatorId: req.user.id,
                ...EDITABLE,
                donationReceived: 0,
                donations: { none: {} },
            },
        })

        if (count === 0) {
            const [code, message] = await explainNotEditable(postId.data, req.user.id)
            if (code === 409) {
                const post = await prisma.rescuePost.findUnique({
                    where: { id: postId.data },
                    select: { status: true },
                })
                if (post?.status === "OPEN") {
                    return res.status(409).json({ message: "This rescue has received donations and can't be deleted" })
                }
            }
            return res.status(code).json({ message })
        }

        return res.json({ message: "Post deleted" })
    } catch (error) {
        // a donation landed between the check and the delete
        if (error.code === "P2003") {
            return res.status(409).json({ message: "This rescue has received donations and can't be deleted" })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to delete post" });
    }
}
