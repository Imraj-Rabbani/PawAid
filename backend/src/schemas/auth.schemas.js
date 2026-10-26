import z from "zod";

export const registerSchema = z.object({
    name: z.string().trim().min(3, "Name must be at least 3 characters long."),
    email: z.email("Please provide a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters long.")
});

export const loginSchema = z.object({
    email: z.email("Please provide a valid email address."),
    password: z.string().min(1, "Password is required."),
});

export const googleLoginSchema = z.object({
    credential: z.string().min(1, "Google credential is required."),
});

export const forgotPasswordSchema = z.object({
    email: z.email("Please provide a valid email address."),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, "Reset link is invalid."),
    password: z.string().min(8, "Password must be at least 8 characters long."),
});
