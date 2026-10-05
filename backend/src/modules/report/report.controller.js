import z from "zod";
import { prisma } from "../../db.js";

// keep in sync with REPORT_REASONS in frontend/src/components/feed/ReportPostModal.jsx
export const REPORT_REASONS = [
    "Spam",
    "Fake or misleading",
    "Inappropriate content",
    "Scam or fraud",
    "Other",
];

const reportSchema = z.object({
    reason: z.enum(REPORT_REASONS, "Please choose a reason."),
    description: z.string().trim().max(1000, "Details are too long.").optional(),
});


export async function reportPost(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const parsed = reportSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: parsed.error.flatten().fieldErrors,
            });
        }

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            select: { id: true, creatorId: true },
        })
        if (!post) {
            return res.status(404).json({ message: "Post not found" })
        }

        if (post.creatorId === req.user.id) {
            return res.status(400).json({ message: "You cannot report your own post" })
        }

        // one open report per user per post, so the admin queue isn't flooded
        const existing = await prisma.postReport.findFirst({
            where: { postId: post.id, reporterId: req.user.id, status: "PENDING" },
            select: { id: true },
        })
        if (existing) {
            return res.status(409).json({ message: "You have already reported this post" })
        }

        const { reason, description } = parsed.data

        const report = await prisma.postReport.create({
            data: {
                postId: post.id,
                reporterId: req.user.id,
                reason,
                description: description || null,
            },
        })

        return res.status(201).json({
            message: "Report submitted",
            data: report
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to submit report" });
    }
}
