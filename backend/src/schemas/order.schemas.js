import z from "zod";
import { PHONE_PATTERN } from "./common.schemas.js";

export const checkoutSchema = z.object({
    items: z
        .array(z.object({
            productId: z.uuid("Invalid product."),
            quantity: z.number("Quantity must be a number.").int("Quantity must be a whole number.").min(1).max(99),
        }), "Your cart is empty.")
        .min(1, "Your cart is empty.")
        .max(48, "Too many different products in one order."),
    // online payments (bKash, Nagad, card) are switched off for now
    paymentMethod: z.enum(["CASH", "WALLET"], "Choose a payment method."),
    delivery: z.object({
        name: z.string("Recipient name is required.").trim().min(3, "Recipient name is too short.").max(100, "Recipient name is too long."),
        phone: z.string("Phone number is required.").trim().regex(PHONE_PATTERN, "Enter a valid phone number."),
        address: z.string("Delivery address is required.").trim().min(10, "Enter the full delivery address.").max(500, "Address must be 500 characters or fewer."),
    }, "Delivery details are required."),
    saveAddress: z.boolean().optional(),
    // the total the buyer saw; if prices moved since, they confirm again instead of being charged a surprise
    expectedTotal: z.number().int().optional(),
})
