#!/usr/bin/env node
/**
 * STEP 4A — unit tests for the pure shared libraries (no server code, no
 * database): phone normalisation, admin emails, delivery areas, payment
 * methods, status transitions, WhatsApp success message, formatting.
 *
 * Run: node scripts/test-unit.mjs
 * (TypeScript files are imported directly — Node strips types natively.)
 */

import assert from "node:assert/strict";
import { normaliseKenyanPhone, displayLocalPhone, isNormalisedPhone } from "../lib/phone.ts";
import { parseAdminEmails, isAdminEmail } from "../lib/admin-emails.ts";
import { DELIVERY_AREAS, OTHER_AREA, ALLOWED_AREA_NAMES, deliveryFeeText } from "../lib/delivery.ts";
import { PAYMENT_METHODS, AVAILABLE_PAYMENT_METHOD_IDS, paymentMethodLabel } from "../lib/payment.ts";
import {
  ALLOWED_STATUS_TRANSITIONS,
  ORDER_STATUS_LABELS,
  STATUS_ACTION_LABELS,
  formatNairobiDate,
} from "../lib/order-status.ts";
import { successWhatsappMessage, totalLine } from "../lib/client-order.ts";
import { formatPrice, formatThousands } from "../lib/order.ts";
import { BUSINESS } from "../lib/business.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

console.log("== phone normalisation ==");

test("0712 345 678        -> 254712345678", () =>
  assert.equal(normaliseKenyanPhone("0712 345 678"), "254712345678"));
test("+254712345678       -> 254712345678", () =>
  assert.equal(normaliseKenyanPhone("+254712345678"), "254712345678"));
test("254712345678        -> 254712345678", () =>
  assert.equal(normaliseKenyanPhone("254712345678"), "254712345678"));
test("0112345678 (01XX)   -> 254112345678", () =>
  assert.equal(normaliseKenyanPhone("0112345678"), "254112345678"));
test("0712-345-678        -> 254712345678", () =>
  assert.equal(normaliseKenyanPhone("0712-345-678"), "254712345678"));
test("(0712) 345 678      -> 254712345678", () =>
  assert.equal(normaliseKenyanPhone("(0712) 345 678"), "254712345678"));
test("reject: 12345", () =>
  assert.equal(normaliseKenyanPhone("12345"), null));
test("reject: 0812345678 (08 is not a mobile prefix)", () =>
  assert.equal(normaliseKenyanPhone("0812345678"), null));
test("reject: 07123456789 (too many digits)", () =>
  assert.equal(normaliseKenyanPhone("07123456789"), null));
test("reject: +2547123456789", () =>
  assert.equal(normaliseKenyanPhone("+2547123456789"), null));
test("reject: empty", () =>
  assert.equal(normaliseKenyanPhone(""), null));
test("isNormalisedPhone true for 254712345678", () =>
  assert.equal(isNormalisedPhone("254712345678"), true));
test("displayLocalPhone 254712345678 -> 0712 345 678", () =>
  assert.equal(displayLocalPhone("254712345678"), "0712 345 678"));

console.log("== admin emails ==");

test("parse 'A@x.com, B@Y.com' lowercase+trim", () =>
  assert.deepEqual(parseAdminEmails("A@x.com, B@Y.com"), ["a@x.com", "b@y.com"]));
test("parse skips junk entries", () =>
  assert.deepEqual(parseAdminEmails("owner@test.ke,,not-an-email, x@y.ke"), ["owner@test.ke", "x@y.ke"]));
test("parse undefined -> []", () =>
  assert.deepEqual(parseAdminEmails(undefined), []));
test("isAdminEmail case-insensitive match", () =>
  assert.equal(isAdminEmail("Owner@Test.KE", ["owner@test.ke"]), true));
test("isAdminEmail rejects other email", () =>
  assert.equal(isAdminEmail("guest@example.com", ["owner@test.ke"]), false));
test("isAdminEmail rejects null", () =>
  assert.equal(isAdminEmail(null, ["owner@test.ke"]), false));

console.log("== delivery areas ==");

test("every area has deliveryFeeKes null (no invented fees)", () => {
  for (const a of DELIVERY_AREAS) assert.equal(a.deliveryFeeKes, null, a.name);
});
test("ALLOWED_AREA_NAMES = all areas + Other", () => {
  assert.equal(ALLOWED_AREA_NAMES.length, DELIVERY_AREAS.length + 1);
  assert.ok(ALLOWED_AREA_NAMES.includes(OTHER_AREA));
});
test("Nairobi areas present (Kilimani, Westlands, South B…)", () => {
  for (const name of ["Kilimani", "Westlands", "South B", "Karen", "Umoja", "Nairobi CBD"]) {
    assert.ok(DELIVERY_AREAS.some((a) => a.name === name), name);
  }
});
test("deliveryFeeText(null fee) -> confirmed-when-we-contact", () =>
  assert.equal(deliveryFeeText({ id: "x", name: "X", deliveryFeeKes: null }),
    "Delivery fee confirmed when we contact you"));
test("deliveryFeeText(200) -> KES 200", () =>
  assert.equal(deliveryFeeText({ id: "x", name: "X", deliveryFeeKes: 200 }),
    "Delivery fee: KES 200"));

console.log("== payment methods ==");

test("pay_on_delivery is the only available method today", () =>
  assert.deepEqual(AVAILABLE_PAYMENT_METHOD_IDS, ["pay_on_delivery"]));
test("mpesa_pay_now exists but is not available (built for 4D)", () => {
  const m = PAYMENT_METHODS.find((m) => m.id === "mpesa_pay_now");
  assert.equal(m.available, false);
});
test("paymentMethodLabel maps ids to labels", () =>
  assert.equal(paymentMethodLabel("pay_on_delivery"), "Pay on delivery (cash or M-Pesa)"));

console.log("== order status metadata ==");

test("status flow new->confirmed->out_for_delivery->delivered", () => {
  assert.deepEqual(ALLOWED_STATUS_TRANSITIONS.new, ["confirmed", "cancelled"]);
  assert.deepEqual(ALLOWED_STATUS_TRANSITIONS.confirmed, ["out_for_delivery", "cancelled"]);
  assert.deepEqual(ALLOWED_STATUS_TRANSITIONS.out_for_delivery, ["delivered", "cancelled"]);
});
test("delivered and cancelled are final", () => {
  assert.deepEqual(ALLOWED_STATUS_TRANSITIONS.delivered, []);
  assert.deepEqual(ALLOWED_STATUS_TRANSITIONS.cancelled, []);
});
test("action buttons are labelled by TARGET status", () => {
  // A new order's button moves it TO "confirmed" — so that label is keyed
  // by the target, not by the order's current status.
  assert.equal(STATUS_ACTION_LABELS.confirmed, "Confirm order");
  assert.equal(STATUS_ACTION_LABELS.out_for_delivery, "Mark out for delivery");
  assert.equal(STATUS_ACTION_LABELS.delivered, "Mark delivered");
  assert.equal(STATUS_ACTION_LABELS.cancelled, "Cancel order");
});
test("every status has a label", () => {
  for (const s of ["new", "confirmed", "out_for_delivery", "delivered", "cancelled"]) {
    assert.ok(ORDER_STATUS_LABELS[s], s);
  }
});
test("formatNairobiDate formats in Africa/Nairobi", () => {
  const out = formatNairobiDate("2026-11-27T21:45:00Z"); // 27 Nov 2026 22:45 in EAT? (UTC+3)
  assert.ok(out.includes("Nov"), out);
  assert.ok(out.includes("2026"), out);
  assert.ok(/\d{1,2}:\d{2}/.test(out), out);
});

console.log("== success WhatsApp message ==");

const order = {
  orderNumber: "LF-20261127-0001",
  customerName: "Jane Wanjiku",
  area: "Kilimani",
  items: [
    { productName: "Fried Omena", optionLabel: "1 kg", quantity: 2, unitPriceKes: 400, lineTotalKes: 800 },
  ],
  subtotalKes: 800,
  deliveryFeeKes: null,
  totalKes: null,
  paymentMethod: "pay_on_delivery",
};

test("message contains order number, items, name and area", () => {
  const msg = successWhatsappMessage(BUSINESS, order);
  assert.ok(msg.includes("LF-20261127-0001"), msg);
  assert.ok(msg.includes("2 × Fried Omena (1 kg)"), msg);
  assert.ok(msg.includes("KES 800"), msg);
  assert.ok(msg.includes("Jane Wanjiku"), msg);
  assert.ok(msg.includes("Kilimani"), msg);
  assert.ok(msg.startsWith("Hello Lake Flavour!"), msg);
});
test("totalLine with null fee -> subtotal + delivery to confirm", () =>
  assert.equal(totalLine(order), "KES 800 + delivery fee to confirm"));
test("totalLine with fee -> total (delivery included)", () =>
  assert.equal(totalLine({ ...order, deliveryFeeKes: 150, totalKes: 950 }), "KES 950 (delivery included)"));

console.log("== money formatting (Step 3 regression) ==");

test("formatThousands 1200 -> 1,200", () => assert.equal(formatThousands(1200), "1,200"));
test("formatPrice 400 -> KES 400", () => assert.equal(formatPrice(400), "KES 400"));
test("formatPrice 800 with business currency", () =>
  assert.equal(formatPrice(800, BUSINESS.currency), "KES 800"));

console.log("");
if (failed === 0) {
  console.log(`ALL ${passed} UNIT TESTS PASSED`);
  process.exit(0);
} else {
  console.log(`${passed} passed, ${failed} FAILED`);
  process.exit(1);
}
