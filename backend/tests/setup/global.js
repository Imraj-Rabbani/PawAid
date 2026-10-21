// Starts a throwaway Postgres for the test run and applies the migrations.
// The data directory is temporary and deleted when the run ends.
import { execFileSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import EmbeddedPostgres from "embedded-postgres"
import { TEST_DATABASE_URL, TEST_DB_PORT } from "../../vitest.config.js"

let pg

export async function setup() {
  pg = new EmbeddedPostgres({
    databaseDir: mkdtempSync(path.join(tmpdir(), "pawaid-test-db-")),
    user: "postgres",
    password: "postgres",
    port: TEST_DB_PORT,
    persistent: false,
    onLog: () => {},
  })

  await pg.initialise()
  await pg.start()
  await pg.createDatabase("pawaid_test")

  execFileSync("npx", ["prisma", "migrate", "deploy", "--config", "prisma7.config.ts"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  })
}

export async function teardown() {
  await pg?.stop()
}
