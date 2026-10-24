import { MemoryStore, rateLimit } from "express-rate-limit"


// Caps on how fast one person can hit the routes worth abusing: signing in
// (password guessing), signing up (mass accounts) and moving money. Counts live
// in memory, so they reset on restart and only hold for a single server process.
// Behind a proxy, set TRUST_PROXY or everyone shares the proxy's IP.

const stores = []

function limiter({ windowMs, limit, message, ...options }) {
    const store = new MemoryStore()
    stores.push(store)
    return rateLimit({
        windowMs,
        limit,
        store,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { message },
        ...options,
    })
}

const MINUTE = 60 * 1000

// every attempt from one IP, right or wrong; use before validateBody
export const signinIpLimit = limiter({
    windowMs: 15 * MINUTE,
    limit: 20,
    message: "Too many sign in attempts. Please try again in a few minutes.",
})

// wrong passwords for one account, from any IP; use after validateBody so the
// email is there. A successful sign in doesn't count.
export const signinEmailLimit = limiter({
    windowMs: 15 * MINUTE,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => req.body.email.toLowerCase(),
    message: "Too many failed sign in attempts for this account. Please try again in 15 minutes.",
})

export const signupLimit = limiter({
    windowMs: 60 * MINUTE,
    limit: 5,
    message: "Too many accounts created from this network. Please try again later.",
})

export const googleSigninLimit = limiter({
    windowMs: 15 * MINUTE,
    limit: 20,
    message: "Too many sign in attempts. Please try again in a few minutes.",
})

// one budget per user, shared by every money route; use after requireAuth
export const moneyLimit = limiter({
    windowMs: MINUTE,
    limit: 20,
    keyGenerator: (req) => req.user.id,
    message: "Too many payment requests. Please wait a minute and try again.",
})


// tests start every case with fresh counts
export function resetRateLimits() {
    for (const store of stores) store.resetAll()
}
