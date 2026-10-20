import z from "zod";

// keep in sync with REPORT_REASONS in frontend/src/components/feed/ReportPostModal.jsx
export const REPORT_REASONS = [
    "Spam",
    "Fake or misleading",
    "Inappropriate content",
    "Scam or fraud",
    "Other",
];

export const reportSchema = z.object({
    reason: z.enum(REPORT_REASONS, "Please choose a reason."),
    description: z.string().trim().max(1000, "Details are too long.").optional(),
});
