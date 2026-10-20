import z from "zod";
import { clearablePhone, clearableText } from "./common.schemas.js";

// every field is optional: only the ones sent are changed
export const profileSchema = z.object({
    name: z.string("Name must be text.").trim().min(3, "Name must be at least 3 characters long.").max(100, "Name is too long."),
    phone: clearablePhone,
    address: clearableText("Address", 500),
}).partial()
