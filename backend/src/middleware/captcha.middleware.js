import { isCaptchaEnabled, verifyCaptcha } from "../services/captcha.services.js"

// Turnstile tokens are at most 2048 characters
const MAX_TOKEN_LENGTH = 2048

// Refuses the request unless the X-Captcha-Token header holds a token Cloudflare
// accepts. Off while TURNSTILE_SECRET_KEY is unset (local dev, tests).
// On sign in, use before signinEmailLimit so requests without a solved CAPTCHA
// can't lock someone else's account.
export async function requireCaptcha(req, res, next) {
    if (!isCaptchaEnabled()) return next()

    const token = req.get("X-Captcha-Token")
    if (!token || token.length > MAX_TOKEN_LENGTH) {
        return res.status(400).json({ message: "Please complete the security check." })
    }

    let passed
    try {
        passed = await verifyCaptcha(token, req.ip)
    } catch (error) {
        console.error("CAPTCHA check failed:", error.message)
        return res.status(503).json({ message: "We couldn't run the security check. Please try again in a moment." })
    }

    if (!passed) {
        return res.status(400).json({ message: "The security check failed or expired. Please try again." })
    }

    next()
}
