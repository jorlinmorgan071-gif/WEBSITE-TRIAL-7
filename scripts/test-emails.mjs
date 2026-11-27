#!/usr/bin/env node
/**
 * STEP 4A — E2E tests for order notifications (Resend).
 *
 * Phases (each with a fresh `next start` so its env applies):
 *   A. Mock Resend, no verified domain: exactly ONE email — the OWNER email
 *      (order number, customer, items, area, notes, total, admin link) — and
 *      the customer email is skipped + logged.
 *   B. RESEND_SEND_TO_CUSTOMERS=true: customer confirmation also sent.
 *   C. Email backend DOWN (dead port): the order is STILL SAVED and the
 *      failure is recorded in order_events ("notification_failed").
 *   D. Real api.resend.com with an invalid key: still saved + failure event
 *      (proves graceful handling of a real provider rejection).
 *
 * Run AFTER: npm run build + the local database running.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import postgres from "postgres";
import { startNext, stopNext } from "./lib/test-server.mjs";

const SUPER = "postgres://postgres:postgres@127.0.0.1:5333/lakeflavour";
const RESEND_MOCK_PORT = 4545;
const PORT = 3210;

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

/** Recording "Resend" API — captures the requests the app sends. */
function startResendRecorder() {
  const captured = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      captured.push({
        method: req.method,
        path: req.url,
        auth: req.headers["authorization"] ?? null,
        body: body ? JSON.parse(body) : null,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "email-test-id" }));
    });
  });
  return new Promise((resolve) => {
    server.listen(RESEND_MOCK_PORT, "127.0.0.1", () =>
      resolve({ server, captured: () => captured })
    );
  });
}

const run = async () => {
  const sql = postgres(SUPER, { max: 4 });
  const [option] = await sql`select id from product_options where option_key = '1kg'`;
  assert.ok(option, "run scripts/migrate.mjs first");

  const recorder = await startResendRecorder();

  let ipCounter = 90;
  const nextIp = () => `10.78.0.${ipCounter++}`;

  const placeOrder = async (base) => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
      body: JSON.stringify({
        name: "Jane Wanjiku",
        phone: "0712 345 678",
        email: "jane@example.com",
        area: "Kilimani",
        addressDetails: "House 4B, blue gate opposite the school",
        notes: "extra spicy, please",
        consent: true,
        paymentMethod: "pay_on_delivery",
        items: [{ optionId: option.id, quantity: 2 }],
        idempotencyKey: crypto.randomUUID(),
        companyWebsite: "",
      }),
    });
    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 201, JSON.stringify(body));
    return body.order;
  };

  const eventsFor = async (orderNumber) =>
    (await sql`select e.type, e.note from order_events e join orders o on o.id = e.order_id
               where o.order_number = ${orderNumber} order by e.created_at`);

  try {
    console.log("== A. owner email only (no verified sending domain) ==");

    let server = await startNext({
      port: PORT,
      env: {
        RESEND_API_BASE_URL: `http://127.0.0.1:${RESEND_MOCK_PORT}`,
        RESEND_API_KEY: "mock-resend-key",
        OWNER_EMAIL: "owner@lakeflavour.test",
        RESEND_SEND_TO_CUSTOMERS: "",
      },
    });

    try {
      const order = await placeOrder(server.base);
      assert.equal(recorder.captured().length, 1, "expected exactly one email");
      const email = recorder.captured()[0];

      await test("owner email: POST /emails with the API key, to OWNER_EMAIL", () => {
        assert.equal(email.method, "POST");
        assert.equal(email.path, "/emails");
        assert.equal(email.auth, "Bearer mock-resend-key");
        assert.deepEqual(email.body.to, ["owner@lakeflavour.test"]);
        assert.ok(email.body.from.includes("Lake Flavour"));
      });

      await test("owner email content: number, customer, items, area, notes, link", () => {
        const text = email.body.text;
        assert.ok(text.includes(order.orderNumber), "order number");
        assert.ok(text.includes("Jane Wanjiku"), "customer name");
        assert.ok(text.includes("+254712345678"), "customer phone");
        assert.ok(text.includes("jane@example.com"), "customer email");
        assert.ok(text.includes("Kilimani"), "area");
        assert.ok(text.includes("House 4B"), "address");
        assert.ok(text.includes("extra spicy"), "notes");
        assert.ok(text.includes("2 × Fried Omena (1 kg)"), "items");
        assert.ok(text.includes("KES 800"), "subtotal");
        assert.ok(text.includes("/admin/orders"), "admin link");
        assert.ok(
          new RegExp(`New order ${order.orderNumber.replace(/[-]/g, "\\-")}`).test(
            email.body.subject
          ),
          email.body.subject
        );
      });

      await test("customer email skipped + logged (no verified sending domain)", () => {
        assert.equal(recorder.captured().length, 1, "no second email may be sent");
        assert.ok(
          server.output().includes("customer email skipped"),
          "expected skip log in server output"
        );
      });
    } finally {
      await stopNext(server);
    }

    console.log("== B. RESEND_SEND_TO_CUSTOMERS=true → customer confirmation ==");

    server = await startNext({
      port: PORT + 1,
      env: {
        RESEND_API_BASE_URL: `http://127.0.0.1:${RESEND_MOCK_PORT}`,
        RESEND_API_KEY: "mock-resend-key",
        OWNER_EMAIL: "owner@lakeflavour.test",
        RESEND_SEND_TO_CUSTOMERS: "true",
      },
    });
    try {
      const order = await placeOrder(server.base);
      const captured = recorder.captured();
      assert.equal(captured.length, 3, `expected 3 emails total, got ${captured.length}`);
      const customer = captured[2];

      await test("customer confirmation sent to the customer", () => {
        assert.deepEqual(customer.body.to, ["jane@example.com"]);
        assert.ok(customer.body.subject.includes(order.orderNumber), customer.body.subject);
        assert.ok(customer.body.text.includes("Thank you for your Lake Flavour order"));
        assert.ok(customer.body.text.includes("2 × Fried Omena (1 kg)"));
        assert.ok(customer.body.text.includes("confirm delivery"));
        assert.ok(customer.body.text.includes("Pay on delivery"));
      });
    } finally {
      await stopNext(server);
    }

    console.log("== C. email backend DOWN → order STILL saved, failure recorded ==");

    server = await startNext({
      port: PORT + 2,
      env: {
        RESEND_API_BASE_URL: "http://127.0.0.1:9", // closed port
        RESEND_API_KEY: "mock-resend-key",
        OWNER_EMAIL: "owner@lakeflavour.test",
      },
    });
    try {
      const order = await placeOrder(server.base);
      await test("order committed despite the email backend being down", async () => {
        const [row] = await sql`select order_number, status from orders where order_number = ${order.orderNumber}`;
        assert.equal(row?.order_number, order.orderNumber);
        assert.equal(row.status, "new");
      });
      await test("notification failure recorded in order_events", async () => {
        const events = await eventsFor(order.orderNumber);
        const failed = events.find((e) => e.type === "notification_failed");
        assert.ok(failed, `expected notification_failed, got ${JSON.stringify(events)}`);
        assert.ok(failed.note.includes("Owner email failed"), failed.note);
      });
    } finally {
      await stopNext(server);
    }

    console.log("== D. real api.resend.com with an invalid key → graceful failure ==");

    server = await startNext({
      port: PORT + 3,
      env: {
        RESEND_API_BASE_URL: "https://api.resend.com",
        RESEND_API_KEY: "re_invalid_key_local_test_only",
        OWNER_EMAIL: "owner@lakeflavour.test",
      },
    });
    try {
      const order = await placeOrder(server.base);
      await test("order saved + real provider rejection recorded", async () => {
        const [row] = await sql`select order_number from orders where order_number = ${order.orderNumber}`;
        assert.ok(row, "order must exist");
        const events = await eventsFor(order.orderNumber);
        const failed = events.find((e) => e.type === "notification_failed");
        assert.ok(failed, `expected notification_failed, got ${JSON.stringify(events)}`);
        assert.ok(/401|rejected|failed/i.test(failed.note), failed.note);
      });
    } finally {
      await stopNext(server);
    }
  } finally {
    recorder.server.close();
    await sql.end();
  }

  console.log("");
  if (failed === 0) {
    console.log(`ALL ${passed} EMAIL TESTS PASSED`);
    process.exit(0);
  }
  console.log(`${passed} passed, ${failed} FAILED`);
  process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
