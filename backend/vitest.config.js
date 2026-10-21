import { defineConfig } from "vitest/config"

// Port of the throwaway Postgres that tests/setup/global.js starts
export const TEST_DB_PORT = 54329
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/pawaid_test`

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    globalSetup: ["tests/setup/global.js"],
    setupFiles: ["tests/setup/each-file.js"],
    // set before src/config/env.js loads .env, and dotenv never overrides an
    // existing variable, so the tests can't reach the real database
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "test-secret",
    },
    // every file shares the one database, so they run one at a time
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: 20000,
  },
})
