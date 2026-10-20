import z from "zod";

export const areaNameField = (required) =>
    z.string(required).trim().min(2, "Area name is too short.").max(100, "Area name is too long.")

export const addAreaSchema = z.object({
    area: areaNameField("Area name is required."),
})

// create and edit take the same fields (posts can arrive as multipart form data)
export const postSchema = z.object({
    title: z.string().trim().min(3, "Title must be at least 3 characters long.").max(150, "Title is too long."),
    description: z.string().trim().min(10, "Description must be at least 10 characters long."),
    rescueAreaId: z.uuid("Please select a rescue area."),
    donationTarget: z.coerce.number("Donation target must be a number.").int("Donation target must be a whole number.").min(0, "Donation target cannot be negative.").max(10000000, "Donation target is too large.").optional(),
});

// which statuses each progress step can come from
export const PROGRESS_FROM = {
    IN_PROGRESS: ["ASSIGNED"],
    RESOLVED: ["ASSIGNED", "IN_PROGRESS"],
};

export const progressSchema = z.object({
    status: z.enum(Object.keys(PROGRESS_FROM), "Status must be IN_PROGRESS or RESOLVED."),
    note: z.string().trim().max(1000, "Update is too long.").optional(),
});

export const rescueUpdateSchema = z.object({
    note: z.string().trim().max(1000, "Update is too long.").default(""),
})
