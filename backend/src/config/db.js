import "dotenv/config"

const env = {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    JWT_SECRET: process.env.JWT_SECRET ?? "secret_123",
    JWT_EXPIRY: process.env.JWT_EXPIRY ?? "7d",
    PORT: process.env.port ?? 3000
}

export default env;