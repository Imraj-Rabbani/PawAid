import { PrismaClient } from "./generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import env from "./config/env.js";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // Opening a connection to the remote database costs seconds (TLS handshake),
  // so keep idle ones around instead of closing them after the 10s default
  idleTimeoutMillis: 5 * 60 * 1000,
});

export const prisma = new PrismaClient({
  adapter,
});