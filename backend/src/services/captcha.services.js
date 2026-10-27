import env from "../config/env.js"

// Cloudflare Turnstile, the "are you human" check on sign in and sign up.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export const isCaptchaEnabled = () => Boolean(env.TURNSTILE_SECRET_KEY)

// Asks Cloudflare whether a token the widget gave the browser is genuine. A token
// works once and expires after five minutes. Throws if Cloudflare can't be reached.
export async function verifyCaptcha(token, ip) {
    const res = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`Turnstile responded ${res.status}`)

    const body = await res.json()
    return body.success === true
}
