#!/usr/bin/env node
/**
 * STEP 4A — E2E tests for the owner orders dashboard (/admin/orders).
 *
 * Auth is enforced on the server for every request. The local test suite has
 * no hosted Supabase, so scripts/mock-gotrue.mjs stands in for the AUTH
 * SERVICE (never the database) and the session cookie is crafted exactly the
 * way @supabase/ssr stores it ("base64-" + base64url(session JSON) under
 * sb-<ref>-auth-token) — the real getUser() → /auth/v1/user code path runs.
 *
 * Phases:
 *   A. Supabase not configured: /admin redirects to /admin/login, no data.
 *   B. Mock auth: unauthenticated blocked; non-admin gets a 404; the ADMIN
 *      email sees the orders, newest first.
 *   C. Status changes through the REAL server action (progressive
 *      enhancement form POST): new→confirmed→out_for_delivery→delivered with
 *      an order_events row each; invalid transitions rejected; cancelling
 *      RESTORES THE STOCK.
 *
 * Run AFTER: npm run build + the local database running.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { startNext, stopNext } from "./lib/test-server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const SUPER = "postgres://postgres:postgres@127.0.0.1:5333/lakeflavour";
const GOTRUE_PORT = 3600;
const PORT = 3220;

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(() => fn())
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

/** Session cookie exactly as @supabase/ssr stores it (base64url JSON). */
function sessionCookie(accessToken, email) {
  const session = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "test-refresh-token",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email,
      aud: "authenticated",
      role: "authenticated",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  };
  // storageKey = sb-<first hostname label of the Supabase URL>-auth-token
  const value = "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `sb-127-auth-token=${value}; Path=/; SameSite=Lax`;
}

const ADMIN_COOKIE = () => sessionCookie("test-admin-token", "owner@lakeflavour.test");
const NONADMIN_COOKIE = () => sessionCookie("test-other-token", "someone-else@example.com");

const run = async () => {
  const sql = postgres(SUPER, { max: 4 });

  // ---- setup: mock auth server + two known orders -----------------------
  const gotrue = spawn(process.execPath, [path.join(REPO, "scripts", "mock-gotrue.mjs")], {
    env: { ...process.env, MOCK_GOTRUE_PORT: String(GOTRUE_PORT) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  await new Promise((resolve) => setTimeout(resolve, 600)); // let it listen

  const [opt1] = await sql`select id from product_options where option_key = '1kg'`;
  await sql`delete from orders`;
  await sql`delete from order_idempotency`;
  const makeOrder = async (customerName) => {
    const [row] = await sql`
      insert into orders (order_number, customer_name, phone, area, address_details, subtotal_kes)
      values (${"LF-ADMINTEST-" + customerName.split(" ")[0].toUpperCase()}, ${customerName},
              '254712345678', 'Kilimani', 'test address', 400)
      returning id, order_number`;
    await sql`insert into order_items (order_id, product_id, option_id, product_name, option_label, unit_price_kes, quantity, line_total_kes)
              values (${row.id}, (select product_id from product_options where id = ${opt1.id}), ${opt1.id},
                      'Fried Omena', '1 kg', 400, 1, 400)`;
    return row;
  };
  const first = await makeOrder("First Customer");
  const second = await makeOrder("Second Customer");

  try {
    console.log("== A. Supabase not configured: nobody gets in ==");

    let server = await startNext({
      port: PORT,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      },
    });
    try {
      await test("/admin → /admin/orders (redirect)", async () => {
        const res = await fetch(`${server.base}/admin`, { redirect: "follow" });
        // /admin redirects to /admin/orders, which (unauthenticated) lands on
        // the login page — no admin content on the way.
        assert.ok(
          res.url.includes("/admin/orders") || res.url.includes("/admin/login"),
          `unexpected final URL ${res.url}`
        );
        const html = await res.text();
        assert.ok(!html.includes("Second Customer"), "order data leaked");
      });
      await test("/admin/orders unauthenticated → redirect to /admin/login", async () => {
        const res = await fetch(`${server.base}/admin/orders`, { redirect: "manual" });
        assert.equal(res.status, 307);
        assert.ok(res.headers.get("location").includes("/admin/login"));
      });
      await test("login page renders, shows NO order data", async () => {
        const res = await fetch(`${server.base}/admin/login`);
        const html = await res.text();
        assert.equal(res.status, 200);
        assert.ok(html.includes("Owner sign-in"));
        assert.ok(!html.includes(second.order_number), "order number leaked to login page");
        assert.ok(!html.includes("Second Customer"), "customer data leaked");
      });
    } finally {
      await stopNext(server);
    }

    console.log("== B. mock auth: unauthenticated / non-admin blocked, admin in ==");

    server = await startNext({
      port: PORT + 1,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${GOTRUE_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "",
      },
    });
    const adminBase = server.base;
    const authedGet = (path, cookie) =>
      fetch(`${adminBase}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });

    let adminHtml = "";
    try {
      await test("unauthenticated (no cookie) → redirect to login", async () => {
        const res = await authedGet("/admin/orders", null);
        assert.equal(res.status, 307);
        assert.ok(res.headers.get("location").includes("/admin/login"));
      });
      await test("signed-in NON-admin email → 404, no data", async () => {
        const res = await authedGet("/admin/orders", NONADMIN_COOKIE());
        assert.equal(res.status, 404);
        const html = await res.text();
        assert.ok(!html.includes(second.order_number), "order data leaked to a non-admin");
      });
      await test("admin email → orders list, newest first", async () => {
        const res = await authedGet("/admin/orders", ADMIN_COOKIE());
        assert.equal(res.status, 200);
        adminHtml = await res.text();
        assert.ok(adminHtml.includes(second.order_number), "newest order missing");
        assert.ok(adminHtml.includes(first.order_number), "older order missing");
        assert.ok(adminHtml.includes("Second Customer"));
        assert.ok(adminHtml.includes("Kilimani"));
        assert.ok(adminHtml.includes("Confirm order"), "status action button missing");
        const newer = adminHtml.indexOf(second.order_number);
        const older = adminHtml.indexOf(first.order_number);
        assert.ok(newer !== -1 && older !== -1 && newer < older, "newest order must be first");
      });
      await test("orders page is noindex", () => {
        assert.ok(adminHtml.includes("noindex"), "expected robots noindex meta");
      });
    } catch (error) {
      await stopNext(server);
      throw error;
    }

    console.log("== C. status changes through the real server action ==");

    /** Submit the order-status server action the way the no-JS form does
     *  (multipart form data, the action id as a field). */
    const callStatusAction = async (orderId, nextStatus, currentStatus, cookie) => {
      // The action id is rendered as a hidden $ACTION_ID_<id> input.
      const match = adminHtml.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
      assert.ok(match, "server action id not found in page HTML");
      const fd = new FormData();
      fd.set(match[1], "");
      fd.set("orderId", orderId);
      fd.set("nextStatus", nextStatus);
      fd.set("currentStatus", currentStatus);
      return fetch(`${adminBase}/admin/orders`, {
        method: "POST",
        redirect: "manual",
        headers: cookie ? { cookie } : {},
        body: fd,
      });
    };

    try {
      await test("new → confirmed (button: Confirm order)", async () => {
        const res = await callStatusAction(second.id, "confirmed", "new", ADMIN_COOKIE());
        assert.ok([200, 303].includes(res.status), `status ${res.status}`);
        const [row] = await sql`select status from orders where id = ${second.id}`;
        assert.equal(row.status, "confirmed");
        const events = await sql`select type, note from order_events where order_id = ${second.id} order by created_at`;
        assert.ok(events.some((e) => e.type === "status_changed" && e.note.includes("new -> confirmed")));
        assert.ok(events.some((e) => e.note.includes("by owner@lakeflavour.test")), "actor missing in audit note");
      });

      await test("confirmed → out_for_delivery → delivered (full chain)", async () => {
        await callStatusAction(second.id, "out_for_delivery", "confirmed", ADMIN_COOKIE());
        await callStatusAction(second.id, "delivered", "out_for_delivery", ADMIN_COOKIE());
        const [row] = await sql`select status from orders where id = ${second.id}`;
        assert.equal(row.status, "delivered");
      });

      await test("invalid transition (new → delivered) is rejected", async () => {
        const res = await callStatusAction(first.id, "delivered", "new", ADMIN_COOKIE());
        assert.ok([200, 303].includes(res.status), `status ${res.status}`);
        const [row] = await sql`select status from orders where id = ${first.id}`;
        assert.equal(row.status, "new", "invalid transition must not change status");
      });

      await test("status action WITHOUT a session is refused", async () => {
        const res = await callStatusAction(first.id, "confirmed", "new", null);
        const [row] = await sql`select status from orders where id = ${first.id}`;
        assert.equal(row.status, "new", "unauthenticated action must not change anything");
        assert.ok([307, 303, 200].includes(res.status), `status ${res.status}`);
      });

      await test("status action by a NON-ADMIN is refused", async () => {
        await callStatusAction(first.id, "confirmed", "new", NONADMIN_COOKIE());
        const [row] = await sql`select status from orders where id = ${first.id}`;
        assert.equal(row.status, "new", "non-admin action must not change anything");
      });

      await test("cancelling restores the stock", async () => {
        await sql`update product_options set stock_quantity = 10 where option_key = '1kg'`;
        // place a real order through the API (qty 3) so stock is decremented
        const res = await fetch(`${adminBase}/api/orders`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "10.79.0.7" },
          body: JSON.stringify({
            name: "Cancel Tester",
            phone: "0712345678",
            email: "cancel@example.com",
            area: "Other",
            addressDetails: "Somewhere in Nairobi, near the market",
            consent: true,
            paymentMethod: "pay_on_delivery",
            items: [{ optionId: opt1.id, quantity: 3 }],
            idempotencyKey: "cancel-test-" + Date.now(),
            companyWebsite: "",
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201, JSON.stringify(body));

        const [stockAfterOrder] = await sql`select stock_quantity::int as q from product_options where option_key = '1kg'`;
        assert.equal(stockAfterOrder.q, 7);

        const [orderRow] = await sql`select id from orders where order_number = ${body.order.orderNumber}`;
        await callStatusAction(orderRow.id, "cancelled", "new", ADMIN_COOKIE());

        const [row] = await sql`select status from orders where id = ${orderRow.id}`;
        assert.equal(row.status, "cancelled");
        const [stockAfterCancel] = await sql`select stock_quantity::int as q from product_options where option_key = '1kg'`;
        assert.equal(stockAfterCancel.q, 10, "cancelling must restore the stock");
        const events = await sql`select type from order_events where order_id = ${orderRow.id} and type = 'status_changed'`;
        assert.equal(events.length, 1);
        await sql`update product_options set stock_quantity = 50 where option_key = '1kg'`;
      });
    } finally {
      await stopNext(server);
    }
  } finally {
    gotrue.kill("SIGTERM");
    await sql.end();
  }

  console.log("");
  if (failed === 0) {
    console.log(`ALL ${passed} ADMIN TESTS PASSED`);
    process.exit(0);
  }
  console.log(`${passed} passed, ${failed} FAILED`);
  process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
