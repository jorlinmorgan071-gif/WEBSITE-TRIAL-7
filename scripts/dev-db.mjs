#!/usr/bin/env node
/**
 * STEP 4A — local development/test database (embedded Postgres, no root
 * needed, no Docker). This is LOCAL-ONLY tooling: the Supabase project used
 * in production does not need it (migrations apply there via the SQL editor).
 *
 * Commands:
 *   node scripts/dev-db.mjs start   # boot (initialises on first run)
 *   node scripts/dev-db.mjs stop
 *   node scripts/dev-db.mjs status  # check readiness + connection
 *
 * The cluster listens on 127.0.0.1 only. Users/passwords below are LOCAL
 * TEST credentials (throwaway data), not secrets.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import EmbeddedPostgres from "embedded-postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const dataDir = path.join(repo, ".pgdata");
const PORT = Number(process.env.PG_PORT ?? 5333);
const USER = "postgres";
const PASSWORD = "postgres";
const DB = "lakeflavour";
const URL = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;

/**
 * Supabase-compatible roles for LOCAL tests only (a hosted Supabase project
 * already has them). `anon` and `authenticated` mirror the public PostgREST
 * roles — RLS tests connect as them. `service_role` has BYPASSRLS like the
 * real one.
 */
const ROLES_SQL = `
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon login password 'anon';
  else
    alter role anon with login password 'anon';
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated login password 'authenticated';
  else
    alter role authenticated with login password 'authenticated';
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role login bypassrls password 'service_role';
  else
    alter role service_role with login bypassrls password 'service_role';
  end if;
end
$$;
`;

const command = process.argv[2] ?? "start";

async function connect(url, timeoutMs = 30000) {
  const sql = postgres(url, { max: 1, connect_timeout: 3 });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await sql`select 1`;
      return sql;
    } catch (error) {
      if (Date.now() > deadline) {
        await sql.end({ timeout: 1 }).catch(() => {});
        throw error;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

async function start() {
  const eg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    autoRehydrateSymlinks: true,
  });

  if (!fs.existsSync(dataDir)) {
    console.log(`[dev-db] initialising cluster in ${dataDir} …`);
    await eg.initialise();
    await eg.start();
    try {
      await eg.createDatabase(DB);
      console.log(`[dev-db] database "${DB}" created`);
    } catch (error) {
      if (!String(error?.message ?? "").includes("already exists")) throw error;
    }
  } else {
    try {
      await eg.start();
    } catch (error) {
      // Already running is fine — verify below.
      if (!String(error?.message ?? "").toLowerCase().includes("running")) {
        console.warn(`[dev-db] start said: ${error?.message ?? error}`);
      }
    }
  }

  // Wait for readiness, then make sure the local roles exist.
  const sql = await connect(URL);
  await sql.unsafe(ROLES_SQL);
  const roles = await sql`select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname`;
  console.log(`[dev-db] ready on 127.0.0.1:${PORT}  db=${DB}  roles=${roles.map((r) => r.rolname).join(",")}`);
  await sql.end();
  console.log(`[dev-db] connection string: ${URL}`);
  // Postgres is daemonised (pg_ctl), so the node wrapper can exit — without
  // this the child's open stdio handles keep the event loop alive.
  process.exit(0);
}

async function stop() {
  // embedded-postgres's stop() only kills a process it spawned itself (same
  // instance); across script invocations it is a no-op. Drive pg_ctl
  // directly instead — "fast" disconnects clients and shuts down cleanly.
  const pgCtl = path.join(
    repo,
    "node_modules",
    "@embedded-postgres",
    "linux-x64",
    "native",
    "bin",
    "pg_ctl"
  );
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync(pgCtl, ["-D", dataDir, "-m", "fast", "stop"], { stdio: "pipe" });
    console.log("[dev-db] stopped (pg_ctl fast)");
  } catch (error) {
    const out = String(error?.stdout ?? "") + String(error?.stderr ?? "");
    if (/no server running|does not exist/i.test(out) || /postmaster\.pid/i.test(String(error?.message ?? ""))) {
      console.log("[dev-db] already stopped");
      return;
    }
    throw error;
  }
}

async function status() {
  const sql = await connect(URL, 1000);
  const [{ ok }] = await sql`select 1 as ok`;
  console.log(`[dev-db] online (${ok === 1 ? "ready" : "unexpected"}) ${URL}`);
  await sql.end();
}

try {
  if (command === "start") await start();
  else if (command === "stop") await stop();
  else if (command === "status") await status();
  else {
    console.error("usage: node scripts/dev-db.mjs start|stop|status");
    process.exit(2);
  }
} catch (error) {
  console.error(`[dev-db] ${command} failed:`, error?.message ?? error);
  process.exit(1);
}
