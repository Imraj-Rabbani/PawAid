import env from "../../config/env.js";
import jwt from "jsonwebtoken";

// The login token lives in an httpOnly cookie, so page scripts (including any
// injected by an XSS bug) can't read it. The browser sends it with every API request.
export const AUTH_COOKIE = "token"

const cookieOptions = {
    httpOnly: true,
    // SameSite=None is only accepted on Secure cookies
    secure: env.COOKIE_SECURE || env.COOKIE_SAME_SITE === "none",
    sameSite: env.COOKIE_SAME_SITE,
    path: "/api",
}

export function sanitizeUser(user) {
    const { password, googleId, ...safeUser } = user
    return safeUser
}


export function generateToken(payload) {
    const token = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRY,
    });
    const { exp } = jwt.decode(token)
    return { token, expiresAt: new Date(exp * 1000) }
}

export function verifyToken(token) {
    return jwt.verify(token, env.JWT_SECRET)
}

// The cookie expires along with the token
export function setAuthCookie(res, { token, expiresAt }) {
    res.cookie(AUTH_COOKIE, token, { ...cookieOptions, expires: expiresAt })
}

export function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE, cookieOptions)
}

export function readCookie(req, name) {
    for (const part of (req.headers.cookie ?? "").split(";")) {
        const [key, ...value] = part.trim().split("=")
        if (key === name) return decodeURIComponent(value.join("="))
    }
    return null
}

// The cookie for the browser; a Bearer header still works for scripts and tests
export function readToken(req) {
    const cookie = readCookie(req, AUTH_COOKIE)
    if (cookie) return cookie

    const authHeader = req.headers.authorization
    if (authHeader?.startsWith("Bearer ")) return authHeader.split(" ")[1].trim() || null

    return null
}
