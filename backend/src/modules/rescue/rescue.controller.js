import z from "zod";
import { prisma } from "../../db.js"
import { uploadToR2 } from "../../services/upload.services.js";


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
    _count: { select: { comments: true } },
};


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
            data: post
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
            include: postInclude,
        })

        const hasMore = posts.length > limit
        if (hasMore) posts.pop()

        return res.json({
            message: "Posts listed",
            data: posts,
            nextCursor: hasMore ? posts[posts.length - 1].id : null
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch posts" });
    }
}
