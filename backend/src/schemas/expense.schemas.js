import z from "zod";

export const expenseSchema = z.object({
    // sent as multipart form data, so it arrives as a string
    amount: z.coerce
        .number("Amount must be a number.")
        .int("Amount must be a whole number.")
        .min(1, "Amount must be at least 1.")
        .max(1000000, "Amount is too large."),
    description: z.string("Describe what the money was spent on.").trim()
        .min(3, "Describe what the money was spent on.")
        .max(500, "Description is too long."),
    orderId: z.uuid("Choose a valid order.").optional().or(z.literal("").transform(() => undefined)),
})
