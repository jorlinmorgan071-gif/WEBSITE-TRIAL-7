#!/usr/bin/env node
/**
 * STEP 4A — E2E tests for POST /api/orders against a production build
 * (`next start`) with the local Postgres.
 *
 * Covers the checklist:
 *   - server-side validation (bad phone/email/consent/quantity/unknown
 *     option/price tampering/unknown fields), nothing created
 *   - phone normalisation end-to-end (all four accepted formats)
 *   - happy path (rows, order number format, price snapshot, stock decrement)
 *   - prices always come from the database (client price tampering is
 *     impossible — the client cannot even send a price)
 *   - insufficient stock: clear "Only N left" message, nothing created
 *   - idempotency: retry (sequential and concurrent) creates exactly ONE order
 *   - concurrency: stock 3, five simultaneous orders, exactly 3 succeed,
 *     stock ends at 0 and never below
 *   - rate limit and honeypot
 *
 * Run AFTER: npm run build, node scripts/dev-db.mjs start, migrations applied.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import postgres from "postgres";
import { startNext, stopNext } from "./lib/test-server.mjs";

const SUPER = "postgres://postgres:postgres@127.0.0.1:5333/lakeflavour";
const PORT = 3200;
const BASE = `http://127.0.0.1:${PORT}`;

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

let ipCounter = 200;
const nextIp = () => `10.77.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

async function post(body, ip) {
  const headers = { "content-type": "application/json", "x-forwarded-for": ip ?? nextIp() };
  if (typeof body === "string") {
    return fetch(`${BASE}/api/orders`, { method: "POST", headers, body });
  }
  return fetch(`${BASE}/api/orders`, { method: "POST", headers, body: JSON.stringify(body) });
}

/** Reset both options' stock so scenarios have a known baseline. */
const makeResetStock = (sql) => async () =>
  await sql`update product_options set stock_quantity = 50`;

const run = async () => {
  const sql = postgres(SUPER, { max: 8 });
  const resetStock = makeResetStock(sql);

  // ---- setup --------------------------------------------------------------
  const [o1, o2] = await sql`select id, option_key from product_options where option_key in ('1kg','2kg') order by option_key`;
  assert.ok(o1 && o2, "seeded options not found — run scripts/migrate.mjs first");
  await sql`update product_options set stock_quantity = 50`;
  await sql`delete from order_idempotency`;
  await sql`delete from orders`;
  await sql`delete from order_number_counters`;

  const server = await startNext({
    port: PORT,
    env: {
      // No real email backend in this suite: notifications take the
      // "skipped, recorded in order_events" path.
      RESEND_API_KEY: "",
    },
  });

  const orderCount = async () => (await sql`select count(*)::int as c from orders`)[0].c;
  const stock = async (key) =>
    (await sql`select stock_quantity::int as q from product_options where option_key = ${key}`)[0].q;
  const valid = (over = {}) => ({
    name: "Jane Wanjiku",
    phone: "0712 345 678",
    email: "jane@example.com",
    area: "Kilimani",
    addressDetails: "House 4B, blue gate opposite the primary school",
    notes: "extra spicy, please",
    consent: true,
    paymentMethod: "pay_on_delivery",
    items: [{ optionId: o1.id, quantity: 1 }],
    idempotencyKey: crypto.randomUUID(),
    companyWebsite: "",
    ...over,
  });

  try {
    console.log("== basic endpoint behaviour ==");

    await test("GET /api/orders is not allowed", async () => {
      const res = await fetch(`${BASE}/api/orders`, { method: "GET", redirect: "manual" });
      assert.equal(res.status, 405);
    });

    await test("malformed JSON body -> 400", async () => {
      const before = await orderCount();
      const res = await post("{not json");
      assert.equal(res.status, 400);
      assert.equal(await orderCount(), before);
    });

    console.log("== server-side validation (nothing is created) ==");

    const rejects = [
      ["bad phone '12345'", { phone: "12345" }, "phone"],
      ["bad email", { email: "not-an-email" }, "email"],
      ["missing consent", { consent: false }, "consent"],
      ["quantity 0", { items: [{ optionId: o1.id, quantity: 0 }] }, "items.0.quantity"],
      ["quantity 11", { items: [{ optionId: o1.id, quantity: 11 }] }, "items.0.quantity"],
      ["fractional quantity 2.5", { items: [{ optionId: o1.id, quantity: 2.5 }] }, "items.0.quantity"],
      ["unknown option id", { items: [{ optionId: crypto.randomUUID(), quantity: 1 }] }, null],
      ["price tampering inside an item", { items: [{ optionId: o1.id, quantity: 1, unitPriceKes: 1 }] }, null],
      ["price tampering at top level", { subtotalKes: 1 }, null],
      ["unknown top-level field", { adminFlag: true }, null],
      ["area outside the list ('Mombasa')", { area: "Mombasa" }, "area"],
      ["name too short", { name: "J" }, "name"],
      ["address too short", { addressDetails: "abc" }, "addressDetails"],
      ["notes too long", { notes: "x".repeat(301) }, "notes"],
      ["pay-now M-Pesa not available yet", { paymentMethod: "mpesa_pay_now" }, "paymentMethod"],
      ["empty items", { items: [] }, "items"],
      ["missing idempotency key", { idempotencyKey: undefined }, "idempotencyKey"],
    ];

    for (const [label, over, field] of rejects) {
      await test(`rejects ${label} (400, nothing created)`, async () => {
        const before = await orderCount();
        const res = await post(valid(over));
        const body = await res.json().catch(() => ({}));
        assert.equal(res.status, 400, `expected 400, got ${res.status}`);
        assert.equal(body.ok, false);
        if (field) {
          assert.ok(body.errors?.[field], `expected field error for ${field}: ${JSON.stringify(body.errors)}`);
        }
        assert.equal(await orderCount(), before);
      });
    }

    console.log("== phone normalisation (end to end) ==");

    await resetStock();
    const phoneCases = [
      ["0712 345 678", "254712345678"],
      ["+254712345678", "254712345678"],
      ["254712345678", "254712345678"],
      ["0112345678", "254112345678"],
    ];
    for (const [raw, expected] of phoneCases) {
      await test(`'${raw}' stored as ${expected}`, async () => {
        const res = await post(valid({ phone: raw }));
        const body = await res.json().catch(() => ({}));
        assert.equal(res.status, 201, JSON.stringify(body));
        const [row] = await sql`select phone from orders where order_number = ${body.order.orderNumber}`;
        assert.equal(row.phone, expected);
      });
    }

    console.log("== happy path ==");

    await resetStock();
    await test("order created with number, snapshot, stock decrement, event", async () => {
      const before = await orderCount();
      const res = await post(valid({ items: [{ optionId: o1.id, quantity: 2 }] }));
      const body = await res.json().catch(() => ({}));
      assert.equal(res.status, 201, JSON.stringify(body));
      assert.equal(body.ok, true);
      assert.match(body.order.orderNumber, /^LF-\d{8}-\d{4}$/);
      assert.equal(body.order.subtotalKes, 800);
      assert.equal(body.order.deliveryFeeKes, null);
      assert.equal(body.order.totalKes, null);
      assert.equal(body.order.paymentMethod, "pay_on_delivery");
      assert.equal(body.order.items.length, 1);
      assert.equal(body.order.items[0].productName, "Fried Omena");
      assert.equal(body.order.items[0].optionLabel, "1 kg");
      assert.equal(body.order.items[0].unitPriceKes, 400);
      assert.equal(body.order.items[0].quantity, 2);
      assert.equal(body.order.items[0].lineTotalKes, 800);
      // no server internals leak to the client
      assert.ok(!("id" in body.order));
      assert.ok(!("consentGiven" in body.order));

      const [row] = await sql`select * from orders where order_number = ${body.order.orderNumber}`;
      assert.equal(row.status, "new");
      assert.equal(row.payment_method, "pay_on_delivery");
      assert.equal(row.payment_status, "unpaid");
      assert.equal(row.consent_given, true);
      assert.equal(row.subtotal_kes, 800);
      assert.equal(row.delivery_fee_kes, null);
      assert.equal(row.total_kes, null);
      assert.equal(row.phone, "254712345678");
      assert.equal(row.area, "Kilimani");
      assert.equal(row.notes, "extra spicy, please");

      const items = await sql`select * from order_items where order_id = ${row.id}`;
      assert.equal(items.length, 1);
      assert.equal(items[0].product_name, "Fried Omena");
      assert.equal(items[0].option_label, "1 kg");
      assert.equal(items[0].unit_price_kes, 400);
      assert.equal(items[0].quantity, 2);
      assert.equal(items[0].line_total_kes, 800);

      const events = await sql`select type from order_events where order_id = ${row.id} order by created_at`;
      assert.equal(events[0].type, "created");

      // resetStock() ran just before this test; this order took 2.
      assert.equal(await stock("1kg"), 50 - 2);
      assert.equal(await orderCount(), before + 1);
    });

    console.log("== prices always come from the database ==");

    await test("server re-reads the price (client cannot set one)", async () => {
      await sql`update product_options set price_kes = 999 where option_key = '1kg'`;
      const res = await post(valid());
      const body = await res.json().catch(() => ({}));
      assert.equal(res.status, 201, JSON.stringify(body));
      assert.equal(body.order.subtotalKes, 999);
      await sql`update product_options set price_kes = 400 where option_key = '1kg'`;
    });

    console.log("== insufficient stock messages ==");

    await test("qty 5 with stock 2 -> 'Only 2 left', nothing created", async () => {
      await sql`update product_options set stock_quantity = 2 where option_key = '2kg'`;
      const before = await orderCount();
      const res = await post(valid({ items: [{ optionId: o2.id, quantity: 5 }] }));
      const body = await res.json().catch(() => ({}));
      assert.equal(res.status, 409, JSON.stringify(body));
      assert.equal(body.code, "insufficient_stock");
      assert.ok(body.message.includes("Only 2 left"), body.message);
      assert.equal(await orderCount(), before);
      assert.equal(await stock("2kg"), 2);
      await sql`update product_options set stock_quantity = 50 where option_key = '2kg'`;
    });

    await test("stock 0 -> out of stock message", async () => {
      await sql`update product_options set stock_quantity = 0 where option_key = '2kg'`;
      const res = await post(valid({ items: [{ optionId: o2.id, quantity: 1 }] }));
      const body = await res.json().catch(() => ({}));
      assert.equal(res.status, 409, JSON.stringify(body));
      assert.ok(/out of stock/i.test(body.message), body.message);
      assert.equal(await stock("2kg"), 0);
      await sql`update product_options set stock_quantity = 50 where option_key = '2kg'`;
    });

    console.log("== idempotency (a retry can never create two orders) ==");

    await test("same key retried sequentially -> ONE order, same number", async () => {
      const key = crypto.randomUUID();
      const first = await post(valid({ idempotencyKey: key }));
      const b1 = await first.json().catch(() => ({}));
      const second = await post(valid({ idempotencyKey: key }));
      const b2 = await second.json().catch(() => ({}));
      assert.equal(first.status, 201, JSON.stringify(b1));
      assert.equal(second.status, 201, JSON.stringify(b2));
      assert.equal(b1.order.orderNumber, b2.order.orderNumber);
      const [{ c }] = await sql`select count(*)::int as c from orders where id = (select order_id from order_idempotency where key = ${key})`;
      assert.equal(c, 1);
    });

    await test("same key fired CONCURRENTLY -> exactly ONE order", async () => {
      const key = crypto.randomUUID();
      const ip = nextIp(); // same IP for both — still under the rate limit
      const [a, b] = await Promise.all([post(valid({ idempotencyKey: key }), ip), post(valid({ idempotencyKey: key }), ip)]);
      const numbers = new Set();
      for (const res of [a, b]) {
        assert.ok([200, 201, 409].includes(res.status), `status ${res.status}`);
        if (res.status !== 409) numbers.add((await res.json()).order.orderNumber);
      }
      assert.equal(numbers.size, 1, `expected one order, got ${[...numbers].join(", ")}`);
      const [{ c }] = await sql`select count(*)::int as c from order_idempotency i join orders o on o.id = i.order_id where i.key = ${key}`;
      assert.equal(c, 1);
    });

    console.log("== concurrency: never oversell, never below zero ==");

    await test("stock 3, five simultaneous orders -> exactly 3 succeed, stock 0", async () => {
      await sql`update product_options set stock_quantity = 3 where option_key = '1kg'`;
      const results = await Promise.all(
        Array.from({ length: 5 }, () => post(valid({ items: [{ optionId: o1.id, quantity: 1 }] })))
      );
      const statuses = results.map((r) => r.status).sort();
      assert.deepEqual(statuses, [201, 201, 201, 409, 409], `statuses: ${statuses.join(",")}`);
      for (const res of results.filter((r) => r.status === 409)) {
        const body = await res.clone().json();
        assert.ok(/Only \d+ left|out of stock/i.test(body.message), body.message);
      }
      assert.equal(await stock("1kg"), 0);
      await sql`update product_options set stock_quantity = 50 where option_key = '1kg'`;
    });

    await test("mixed-size simultaneous orders (lock ordering: no deadlocks)", async () => {
      await resetStock();
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          post(valid({ items: [{ optionId: i % 2 === 0 ? o1.id : o2.id, quantity: 1 }] }))
        )
      );
      assert.ok(results.every((r) => r.status === 201), results.map((r) => r.status).join(","));
      assert.equal(await stock("1kg"), 46); // 4 × 1 kg
      assert.equal(await stock("2kg"), 46); // 4 × 2 kg
    });

    console.log("== honeypot and rate limit ==");

    await test("honeypot filled -> 400, nothing created", async () => {
      const before = await orderCount();
      const res = await post(valid({ companyWebsite: "http://spam.example" }));
      assert.equal(res.status, 400);
      assert.equal(await orderCount(), before);
    });

    await test("6th order attempt from one IP within 10 min -> 429", async () => {
      const ip = nextIp();
      // five attempts (rejected by the honeypot — they still count) …
      for (let i = 0; i < 5; i++) {
        const res = await post(valid({ companyWebsite: "spam" }), ip);
        assert.equal(res.status, 400);
      }
      // … the sixth is rate limited even though it is a valid order …
      const blocked = await post(valid(), ip);
      assert.equal(blocked.status, 429);
      const body = await blocked.json();
      assert.ok(/Too many orders/i.test(body.message));
      // … while a different network can still order.
      const other = await post(valid());
      assert.equal(other.status, 201, await other.text());
    });

    console.log("== integrity summary ==");

    await test("order numbers are unique across every order", async () => {
      const [{ total }] = await sql`select count(*)::int as total from orders`;
      const [{ distinct }] = await sql`select count(distinct order_number)::int as distinct from orders`;
      assert.equal(total, distinct);
    });
  } finally {
    await stopNext(server);
    await sql.end();
  }

  console.log("");
  if (failed === 0) {
    console.log(`ALL ${passed} ORDERS-API TESTS PASSED`);
    process.exit(0);
  }
  console.log(`${passed} passed, ${failed} FAILED`);
  process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
