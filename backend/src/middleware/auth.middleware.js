import { findById } from "../modules/auth/auth.services.js"
import { verifyToken } from "../modules/auth/auth.utils.js"


export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(400).json({
                message: "No header found"
            })
        }

        const token = authHeader.split(" ")[1].trim()

        if (!token) {
            return res.status(400).json({
                message: "Token not found"
            })
        }

        const decoded = verifyToken(token)
        const userId = decoded.userId

        const user = await findById(userId)

        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
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
        return res.status(401).json({
            message: "Not Authorized"
        })
    }

}