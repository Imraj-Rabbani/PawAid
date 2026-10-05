import z from "zod";
import { prisma } from "../../db.js";

const commentSchema = z.object({
    text: z.string().trim().min(1, "Comment cannot be empty.").max(1000, "Comment is too long."),
});

const commentInclude = {
    author: {
        select: {
            id: true,
            name: true,
            role: true,
            profilePictureUrl: true,
        },
    },
};


export async function listComments(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)
        const cursor = z.uuid().safeParse(req.query.cursor)

        // newest first so the first page shows the latest comments, one extra row tells us whether there is more
        const comments = await prisma.comment.findMany({
            where: { postId: postId.data },
            take: limit + 1,
            ...(cursor.success && { cursor: { id: cursor.data }, skip: 1 }),
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: commentInclude,
        })

        const hasMore = comments.length > limit
        if (hasMore) comments.pop()

        return res.json({
            message: "Comments listed",
            data: comments,
            nextCursor: hasMore ? comments[comments.length - 1].id : null
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch comments" });
    }
}

export async function createComment(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const parsed = commentSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: parsed.error.flatten().fieldErrors,
            });
        }

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            select: { id: true },
        })
        if (!post) {
            return res.status(404).json({ message: "Post not found" })
        }

        const comment = await prisma.comment.create({
            data: {
                postId: post.id,
                authorId: req.user.id,
                text: parsed.data.text,
            },
            include: commentInclude,
        })

        return res.status(201).json({
            message: "Comment added",
            data: comment
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add comment" });
    }
}

// Authors can remove their own comments, admins can remove any
export async function deleteComment(req, res){
    try {
        const commentId = z.uuid().safeParse(req.params.commentId)
        if (!commentId.success) {
            return res.status(404).json({ message: "Comment not found" })
        }

        const comment = await prisma.comment.findUnique({
            where: { id: commentId.data },
            select: { id: true, authorId: true },
        })
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" })
        }

        if (comment.authorId !== req.user.id && req.user.role !== "ADMIN") {
            return res.status(403).json({ message: "You can only delete your own comments" })
        }

        await prisma.comment.delete({ where: { id: comment.id } })

        return res.json({ message: "Comment deleted" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete comment" });
    }
}
