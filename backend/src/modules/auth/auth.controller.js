import bcrypt from "bcryptjs";
import { generateToken, sanitizeUser } from "./auth.utils.js"
import { createUser, findUser } from "./auth.services.js";







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


