import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import env from "../../config/env.js";
import { prisma } from "../../db.js";

const googleClient = new OAuth2Client();


export async function findUser(email) {
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
    })

    return user;
}

export async function findById(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    })
    return user
}

export async function createUser({ name, email, password }) {
    const existingUser = await findUser(email)

    if (existingUser) {
        const error = new Error("User with this email already exists.");
        error.statusCode = 409;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
        data: {
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            wallet: { create: {} },
        }
    })
    return user;
}

// Checks the ID token Google's sign-in button gave the browser: signed by Google,
// not expired, and issued for this app. Returns null if any of that fails.
export async function verifyGoogleCredential(credential) {
    if (!env.GOOGLE_CLIENT_ID) {
        const error = new Error("Google sign-in is not configured.");
        error.statusCode = 503;
        throw error;
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: env.GOOGLE_CLIENT_ID,
        })
        return ticket.getPayload()
    } catch {
        return null
    }
}

// Finds the user for a Google account, creating one on first sign-in. An
// existing email/password account with the same verified email is linked to the
// Google account rather than duplicated.
export async function findOrCreateGoogleUser({ sub, email, name }) {
    const linked = await prisma.user.findUnique({ where: { googleId: sub } })
    if (linked) return linked

    const existingUser = await findUser(email)
    if (existingUser) {
        return prisma.user.update({
            where: { id: existingUser.id },
            data: { googleId: sub },
        })
    }

    return prisma.user.create({
        data: {
            name: name || email.split("@")[0],
            email: email.toLowerCase(),
            googleId: sub,
            wallet: { create: {} },
        }
    })
}
