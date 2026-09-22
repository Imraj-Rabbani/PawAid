import env from "../../config/db";
import jwt from "jsonwebtoken";

export function sanitizeUser(user) {
    const { password, ...safeUser } = user
    return safeUser
}


export function generateToken(payload) {
    const token = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRY,
    });
    return token
}

export function verifyToken(token) {
    return jwt.verify(token, env.JWT_SECRET)
}