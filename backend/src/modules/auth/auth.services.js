import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import env from "../../config/env.js";
import { prisma } from "../../db.js";
import { generateToken } from "./auth.utils.js";

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


// Signs a user in: records a session and returns a token that names it.
// Also clears the user's expired sessions so the table doesn't grow forever.
export async function startSession(user) {
    const sessionId = crypto.randomUUID()
    const { token, expiresAt } = generateToken({ userId: user.id, email: user.email, sessionId })

    await prisma.$transaction([
        prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
        prisma.session.create({ data: { id: sessionId, userId: user.id, expiresAt } }),
    ])

    return { token, expiresAt }
}

// The session's user, or null if the session was ended, has expired, or doesn't match the token
export async function findSessionUser({ sessionId, userId }) {
    if (!sessionId) return null

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
    })
    if (!session || session.userId !== userId || session.expiresAt <= new Date()) return null

    return session.user
}

export async function endSession(sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } })
}

// Signs the user out on every device. Takes a transaction client so it can run
// alongside other changes (e.g. suspending the user).
export async function endAllSessions(userId, db = prisma) {
    await db.session.deleteMany({ where: { userId } })
}
