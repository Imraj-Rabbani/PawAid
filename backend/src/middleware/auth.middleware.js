import { findSessionUser } from "../modules/auth/auth.services.js"
import { readToken, verifyToken } from "../modules/auth/auth.utils.js"


export async function requireAuth(req, res, next) {
    try {
        const token = readToken(req)

        if (!token) {
            return res.status(401).json({
                message: "Token not found"
            })
        }

        const user = await findSessionUser(verifyToken(token))

        if (!user) {
            return res.status(401).json({ message: "Your session has ended. Please sign in again." });
        }

        // 401 so the frontend drops the stored user and signs a suspended user out
        if (user.status !== "ACTIVE") {
            return res.status(401).json({ message: "Your account has been suspended" });
        }

        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
        };

        next()
    } catch (error) {
        console.error("Auth error:", error.message)
        return res.status(401).json({ message: "Not Authorized" })
    }

}

// For public routes that show extra details to a signed in user (e.g. which posts they upvoted).
// A missing or bad token is not an error here, the request just continues as a guest.
export async function optionalAuth(req, res, next) {
    try {
        const token = readToken(req)

        if (token) {
            const user = await findSessionUser(verifyToken(token))

            if (user && user.status === "ACTIVE") {
                req.user = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                };
            }
        }
    } catch {
        // treat as a guest
    }

    next()
}
