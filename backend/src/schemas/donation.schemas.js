import z from "zod";
import { amountField } from "./common.schemas.js";

export const donationSchema = z.object({
    amount: amountField,
});

// an admin donating from the PawAid Fund
export const fundDonationSchema = donationSchema.extend({
    destinationType: z.enum(["VOLUNTEER", "RESCUE_POST"], "Choose a volunteer or a rescue post."),
    targetId: z.uuid("Choose who to donate to."),
})
