#!/usr/bin/env node
/**
 * STEP 4A — apply supabase/migrations/*.sql (in filename order) to the
 * database. Used locally against the embedded Postgres; on a hosted Supabase
 * project you apply the same files in the SQL editor instead.
 *
 * Every migration is idempotent, so this script can be run any number of
 * times (the test suite runs it twice on purpose).
 *
 *   DATABASE_URL=postgres://… node scripts/migrate.mjs
 *   (default: the local dev-db from scripts/dev-db.mjs)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const migrationsDir = path.join(repo, "supabase", "migrations");
const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5333/lakeflavour";

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error(`no .sql files found in ${migrationsDir}`);
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await sql.unsafe(content); // simple query protocol: multi-statement files
    console.log(`applied ${file}`);
  }
} finally {
  await sql.end();
}
console.log(`done — ${files.length} migration file(s) applied`);
