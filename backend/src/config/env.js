import "dotenv/config"

const env = {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    JWT_SECRET: process.env.JWT_SECRET ?? "secret_123",
    JWT_EXPIRY: process.env.JWT_EXPIRY ?? "7d",
    PORT: process.env.PORT ?? 3000,
    // how many proxies sit in front of the app (e.g. 1 behind Render, Nginx, Cloudflare);
    // rate limiting reads the client IP through them
    TRUST_PROXY: Number(process.env.TRUST_PROXY ?? 0),
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
}

export default env;