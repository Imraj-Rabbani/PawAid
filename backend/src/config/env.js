import "dotenv/config"

// Anyone who knows the signing key can mint a token for any account, admins
// included, so never start with a missing or guessable one.
// Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
const JWT_SECRET = process.env.JWT_SECRET?.trim() ?? ""
if (JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random string of at least 32 characters")
}

const env = {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    JWT_SECRET,
    JWT_EXPIRY: process.env.JWT_EXPIRY ?? "7d",
    PORT: process.env.PORT ?? 3000,
    // how many proxies sit in front of the app (e.g. 1 behind Render, Nginx, Cloudflare);
    // rate limiting reads the client IP through them
    TRUST_PROXY: Number(process.env.TRUST_PROXY ?? 0),
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    // the login cookie: Secure in production (HTTPS only), and SameSite=none when
    // the frontend is on a different site from the API (e.g. vercel.app and onrender.com)
    COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
    COOKIE_SAME_SITE: (process.env.COOKIE_SAME_SITE ?? "lax").toLowerCase(),
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
}

export default env;