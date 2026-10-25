import { AUTH_COOKIE, readCookie } from "../modules/auth/auth.utils.js"

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"]

// The browser attaches the login cookie to any request for the API, including a form
// another site submits. A page can only add a custom header to a cross-origin request
// after a CORS preflight, and CORS only lets CORS_ORIGIN through, so requiring the
// header means the request came from our frontend.
export function requireCsrfHeader(req, res, next) {
    if (SAFE_METHODS.includes(req.method) || !readCookie(req, AUTH_COOKIE)) return next()

    if (req.headers["x-requested-with"] !== "XMLHttpRequest") {
        return res.status(403).json({ message: "Missing X-Requested-With header" })
    }

    next()
}
