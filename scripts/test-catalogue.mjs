#!/usr/bin/env node
/**
 * STEP 4A — catalogue data-source tests (database with lib/products.ts
 * fallback) using `next dev` (fresh server render on every request, so the
 * source switch is observable per request):
 *
 *   A. database up   → the landing page shows the DATABASE tagline (a unique
 *                      marker set directly in the products table).
 *   B. database DOWN → the page still renders (fallback catalogue), the
 *                      checkout skeleton is present, and POST /api/orders
 *                      returns the friendly "could not place" 503 — the page
 *                      never breaks.
 *
 * (On the production build the same getCatalogue() path runs behind ISR
 * revalidation — see app/page.tsx `export const revalidate = 300`.)
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { startNext, stopNext } from "./lib/test-server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const SUPER = "postgres://postgres:postgres@127.0.0.1:5333/lakeflavour";
const PORT = 3230;

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn()
    .then(() => {
      passed++;
      console.log(`  PASS  ${name}`);
    })
    .catch((error) => {
      failed++;
      console.log(`  FAIL  ${name}`);
      console.log(`        ${error.message}`);
    });
}

const devDb = (args) =>
  execFileSync(process.execPath, [path.join(REPO, "scripts", "dev-db.mjs"), args], {
    stdio: "pipe",
  }).toString();

/** Poll until a direct connection really fails (shutdown is asynchronous). */
async function waitForDbDown(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probe = postgres(SUPER, { max: 1, connect_timeout: 1 });
    try {
      await probe`select 1`;
      await probe.end({ timeout: 1 }).catch(() => {});
      if (Date.now() > deadline) throw new Error("database did not go down in time");
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      await probe.end({ timeout: 1 }).catch(() => {});
      return;
    }
  }
}

const run = async () => {
  const sql = postgres(SUPER, { max: 1 });
  const marker = `DB-MARKER-${Date.now().toString(36)}`;

  const server = await startNext({
    port: PORT,
    env: { DATABASE_URL: SUPER, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
    dev: true,
  });

  try {
    console.log("== A. database up → page renders from the database ==");

    await test("landing page shows a tagline set in the DATABASE", async () => {
      await sql`update products set tagline = ${marker} where slug = 'fried-omena'`;
      // cache-buster: dev caches ISR renders per URL, and this test needs a
      // fresh render to observe the current data source
      const res = await fetch(`${server.base}/?src=db&t=${Date.now()}`);
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.ok(html.includes(marker), "database tagline marker missing from the page");
      assert.ok(html.includes("Fried Omena"), "product name missing");
      // order panel anchor + skeleton must be in the server HTML
      assert.ok(html.includes('id="order"'), "#order anchor missing");
    });

    console.log("== B. database DOWN → fallback, page never breaks ==");

    await sql.end();
    devDb("stop"); // take the database down
    await waitForDbDown(); // make sure it is really down before asserting

    await test("landing page still renders from lib/products.ts fallback", async () => {
      const res = await fetch(`${server.base}/?src=fallback&t=${Date.now()}`);
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.ok(html.includes("Fresh from Lake Victoria"), "fallback tagline missing");
      assert.ok(!html.includes(marker), "database marker must be gone (fallback in use)");
      assert.ok(html.includes("Fried Omena"));
    });

    await test("checkout POST returns a friendly 503 (order NOT lost silently)", async () => {
      const res = await fetch(`${server.base}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.76.0.1" },
        body: JSON.stringify({
          name: "Fallback Tester",
          phone: "0712345678",
          email: "fb@example.com",
          area: "Kilimani",
          addressDetails: "test address, near the school",
          consent: true,
          paymentMethod: "pay_on_delivery",
          items: [{ optionId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
          idempotencyKey: "fallback-test-key-0001",
          companyWebsite: "",
        }),
      });
      assert.equal(res.status, 503, `expected 503, got ${res.status}`);
      const body = await res.json();
      assert.ok(/could not place your order/i.test(body.message), body.message);
    });
  } finally {
    await stopNext(server);
    devDb("start"); // leave the database running for the remaining suites
    // restore the original tagline
    const restore = postgres(SUPER, { max: 1 });
    await restore`update products set tagline = 'Fresh from Lake Victoria' where slug = 'fried-omena'`;
    await restore.end();
  }

  console.log("");
  if (failed === 0) {
    console.log(`ALL ${passed} CATALOGUE TESTS PASSED`);
    process.exit(0);
  }
  console.log(`${passed} passed, ${failed} FAILED`);
  process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
