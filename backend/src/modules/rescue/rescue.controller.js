import z from "zod";
import { prisma } from "../../db.js"
import { uploadToR2 } from "../../services/upload.services.js";
import { creditWallet } from "../../services/wallet.services.js";


const postSchema = z.object({
    title: z.string().trim().min(3, "Title must be at least 3 characters long.").max(150, "Title is too long."),
    description: z.string().trim().min(10, "Description must be at least 10 characters long."),
    rescueAreaId: z.uuid("Please select a rescue area."),
    donationTarget: z.coerce.number("Donation target must be a number.").int("Donation target must be a whole number.").min(0, "Donation target cannot be negative.").max(10000000, "Donation target is too large.").optional(),
});

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
    _count: { select: { comments: true, upvotes: true } },
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
        const name = typeof req.body?.area === "string" ? req.body.area.trim() : ""

        if (!name) {
            return res.status(400).json({ message: "Area name is required" })
        }

        const areaCreated = await prisma.rescueArea.create({
            data: { name }
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
        const parsed = postSchema.safeParse(req.body ?? {})

        if (!parsed.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: parsed.error.flatten().fieldErrors,
            });
        }

        const { title, description, rescueAreaId, donationTarget } = parsed.data

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
const PROGRESS_FROM = {
    IN_PROGRESS: ["ASSIGNED"],
    RESOLVED: ["ASSIGNED", "IN_PROGRESS"],
};

const progressSchema = z.object({
    status: z.enum(Object.keys(PROGRESS_FROM), "Status must be IN_PROGRESS or RESOLVED."),
    note: z.string().trim().max(1000, "Update is too long.").optional(),
});

// The assigned volunteer moves their rescue forward: Assigned -> In Progress -> Rescued.
// Marking it rescued can carry a closing note and photo.
export async function updatePostProgress(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const parsed = progressSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: parsed.error.flatten().fieldErrors,
            });
        }

        const { status, note } = parsed.data
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

        const parsed = postSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: parsed.error.flatten().fieldErrors,
            });
        }

        const { title, description, rescueAreaId, donationTarget = 0 } = parsed.data

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
