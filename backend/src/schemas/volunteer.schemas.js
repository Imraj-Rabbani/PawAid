import z from "zod";
import { clearablePhone, clearableText } from "./common.schemas.js";

// Bangladeshi NIDs are 10, 13 or 17 digits
const nidField = z.string("NID is required.").trim().regex(/^(\d{10}|\d{13}|\d{17})$/, "NID must be 10, 13 or 17 digits.")
const rescueAreaField = z.uuid("Choose a rescue area.")
const descriptionField = clearableText("Description", 1000)

// name, email and profile picture come from the user's account (PRD §5.2)
export const applicationSchema = z.object({
    rescueAreaId: rescueAreaField,
    nid: nidField,
    phone: clearablePhone.optional(),
    address: clearableText("Address", 500).optional(),
    description: descriptionField.optional(),
})

export const volunteerUpdateSchema = z.object({
    rescueAreaId: rescueAreaField,
    nid: nidField,
    description: descriptionField,
}).partial()
