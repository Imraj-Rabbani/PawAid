import z from "zod";

export const PHONE_PATTERN = /^\+?[0-9][0-9 -]{5,18}[0-9]$/

// a whole-taka amount for top ups, donations and transfers
export const amountField = z
    .number("Amount must be a number.")
    .int("Amount must be a whole number.")
    .min(1, "Amount must be at least 1.")
    .max(1000000, "Amount is too large.")

// Optional text a user can clear: trimmed, and "" is saved as null
export const clearableText = (label, max) =>
    z.string(`${label} must be text.`).trim().max(max, `${label} must be ${max} characters or fewer.`).transform((v) => v || null)

// same phone rule as checkout; "" clears it
export const clearablePhone = z
    .string("Phone must be text.")
    .trim()
    .refine((v) => v === "" || PHONE_PATTERN.test(v), "Enter a valid phone number.")
    .transform((v) => v || null)
