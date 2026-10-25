import bcrypt from "bcryptjs";
import { clearAuthCookie, readToken, sanitizeUser, setAuthCookie, verifyToken } from "./auth.utils.js"
import { createUser, endAllSessions, endSession, findOrCreateGoogleUser, findUser, startSession, verifyGoogleCredential } from "./auth.services.js";

const INVALID_CREDENTIALS = "Invalid email or password"

// compared against when the email is unknown, so that path takes as long as a real
// password check and response timing doesn't reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10)






export async function register(req, res) {

    const user = await createUser(req.body)

    setAuthCookie(res, await startSession(user))

    return res.status(201).json({
        message: "Successfully Signed Up",
        user: sanitizeUser(user),
    })
}

export async function login(req, res) {

    const user = await findUser(req.body.email)
    if (!user) {
        await bcrypt.compare(req.body.password, DUMMY_HASH)
        return res.status(400).json({
            message: INVALID_CREDENTIALS,
        });
    }

    // accounts made through Google sign-in have no password to compare against
    if (!user.password) {
        return res.status(400).json({
            message: "This account uses Google sign-in. Please continue with Google.",
        });
    }

    const matchedPassword = await bcrypt.compare(req.body.password, user.password)

    if (!matchedPassword) {
        return res.status(400).json({
            message: INVALID_CREDENTIALS,
        });
    }

    // checked after the password so the response can't be used to probe account status
    if (user.status !== "ACTIVE") {
        return res.status(403).json({
            message: "Your account has been suspended. Please contact support.",
        });
    }

    setAuthCookie(res, await startSession(user))

    return res.json({
        message: "Successfully Logged In",
        user: sanitizeUser(user),
    })
}

export async function googleLogin(req, res) {

    const profile = await verifyGoogleCredential(req.body.credential)
    if (!profile) {
        return res.status(401).json({
            message: "Google sign-in failed. Please try again.",
        });
    }

    // an unverified email could belong to someone else, so it can't be linked to an account
    if (!profile.email || !profile.email_verified) {
        return res.status(400).json({
            message: "Your Google account's email address is not verified.",
        });
    }

    const user = await findOrCreateGoogleUser(profile)

    if (user.status !== "ACTIVE") {
        return res.status(403).json({
            message: "Your account has been suspended. Please contact support.",
        });
    }

    setAuthCookie(res, await startSession(user))

    return res.json({
        message: "Successfully Logged In",
        user: sanitizeUser(user),
    })
}

// Ends this session on the server too, so the token stops working even if it was copied
export async function logout(req, res) {
    const token = readToken(req)
    if (token) {
        try {
            const { sessionId } = verifyToken(token)
            if (sessionId) await endSession(sessionId)
        } catch {
            // an expired or forged token has no session worth ending
        }
    }

    clearAuthCookie(res)
    return res.json({ message: "Signed out" })
}

// For "someone else is using my account": every device has to sign in again
export async function logoutEverywhere(req, res) {
    await endAllSessions(req.user.id)
    clearAuthCookie(res)
    return res.json({ message: "Signed out on every device" })
}
