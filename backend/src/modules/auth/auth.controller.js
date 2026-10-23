import bcrypt from "bcryptjs";
import { generateToken, sanitizeUser } from "./auth.utils.js"
import { createUser, findOrCreateGoogleUser, findUser, verifyGoogleCredential } from "./auth.services.js";







export async function register(req, res) {

    const user = await createUser(req.body)

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

    const user = await findUser(req.body.email)
    if (!user) {
        return res.status(400).json({
            message: "No user with this email",
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
            message: "Credentials do not match",
        });
    }

    // checked after the password so the response can't be used to probe account status
    if (user.status !== "ACTIVE") {
        return res.status(403).json({
            message: "Your account has been suspended. Please contact support.",
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
