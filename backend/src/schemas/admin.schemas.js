import z from "zod";
import { areaNameField } from "./rescue.schemas.js";

export const POST_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"]
export const REPORT_STATUSES = ["PENDING", "REVIEWED", "RESOLVED", "REJECTED"]

export const userStatusSchema = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED"], "Status must be ACTIVE or SUSPENDED."),
})

export const volunteerStatusSchema = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED"], "Status must be ACTIVE or SUSPENDED."),
})

export const postStatusSchema = z.object({
    status: z.enum(POST_STATUSES, "Invalid post status."),
})

export const reportStatusSchema = z.object({
    status: z.enum(REPORT_STATUSES, "Invalid report status."),
})

export const areaSchema = z.object({
    name: areaNameField("Area name is required."),
})

export const categorySchema = z.object({
    name: z.string("Category name is required.").trim().min(2, "Category name is too short.").max(60, "Category name is too long."),
})

// products arrive as multipart form data, so numbers and booleans come in as strings
// (a blank field is treated as missing rather than coerced to 0)
const taka = (label, min, minMessage) => z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number(`${label} must be a number.`).int(`${label} must be a whole number.`).min(min, minMessage),
)
const boolField = z.union([z.boolean(), z.stringbool()], "Active must be true or false.")

const productFields = {
    name: z.string("Product name is required.").trim().min(2, "Product name is too short.").max(120, "Product name is too long."),
    // "" clears the description
    description: z.string().trim().max(2000, "Description is too long.").transform((d) => d || null),
    categoryId: z.uuid("Choose a category."),
    costPrice: taka("Cost price", 0, "Cost price can't be negative."),
    sellingPrice: taka("Selling price", 1, "Selling price must be at least ৳1."),
    stockQty: taka("Stock", 0, "Stock can't be negative."),
    active: boolField,
}

export const createProductSchema = z.object({
    ...productFields,
    description: productFields.description.optional(),
    stockQty: productFields.stockQty.default(0),
    active: boolField.default(true),
})

export const updateProductSchema = z.object(productFields).partial()

export const orderStatusSchema = z.object({
    status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"], "Invalid order status."),
})
