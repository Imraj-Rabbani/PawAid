import z from "zod";
import { prisma } from "../../db";
import bcrypt from "bcryptjs";
import { generateToken, sanitizeUser } from "./auth.utils.js"
import { createUser, findUser } from "./auth.services";



const registerSchema = z.object({
    name: z.string().trim().min(3, "Name must be at least 3 characters long."),
    email: z.email("Please provide a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters long.")
});

const loginSchema = z.object({
    email: z.email("Please provide a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters long."),
});



export async function register(req, res) {
    const parsed = registerSchema.safeParse(req.body)

    if (!parsed.success) {
        return res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        });
    }

    const user = await createUser(parsed.data)

    const token = generateToken({
        userId: user.id,
        email: user.email
    })

    return res.status(201).json({
        message: "Successfully Signed Up",
        user: sanitizeUser(user),
        token: token
    })
}

export async function login(req, res) {
    const parsed = loginSchema.safeParse(req.body)

    if (!parsed.success) {
        return res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        });
    }

    const user = await findUser(parsed.data.email)
    if (!user) {
        return res.status(400).json({
            message: "No user with this email",
        });
    }

    const matchedPassword = await bcrypt.compare(parsed.data.password, user.password)

    if (!matchedPassword) {
        return res.status(400).json({
            message: "Credentials do not match",
        });
    }

    const token = generateToken({
        userId: user.id,
        email: user.email
    })

    return res.json({
        message: "Successfully Logged In",
        user: sanitizeUser(user),
        token: token
    })
}
