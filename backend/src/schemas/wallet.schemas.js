import z from "zod";
import { amountField } from "./common.schemas.js";

export const topUpSchema = z.object({
    amount: amountField,
});

export const transferSchema = z.object({
    volunteerId: z.uuid("Please choose a volunteer."),
    amount: amountField,
    note: z.string().trim().max(200, "Note is too long.").optional(),
});
