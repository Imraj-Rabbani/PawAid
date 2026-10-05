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

export async function listPosts(req, res){
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)
        const cursor = z.uuid().safeParse(req.query.cursor)

        // newest first, one extra row tells us whether there is another page
        const posts = await prisma.rescuePost.findMany({
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
