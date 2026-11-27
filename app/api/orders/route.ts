import { NextResponse, type NextRequest } from "next/server";
import {
  OrderRequestSchema,
  buildOrderPayload,
  zodFieldErrors,
} from "@/lib/server/order-schema";
import { createOrderInDb } from "@/lib/server/orders";
import { sendOrderNotifications } from "@/lib/server/email";
import { checkOrderRateLimit, clientIp } from "@/lib/server/rate-limit";
import type { ClientOrder } from "@/lib/client-order";
import type { DbOrder } from "@/lib/server/db";

/**
 * STEP 4A — POST /api/orders: place an order.
 *
 * Order of defences (cheapest first):
 *   1. Rate limit — 5 order attempts per IP per 10 minutes.
 *   2. Strict zod validation — every field, unknown fields rejected, so
 *      tampered payloads (extra prices, unknown options) never pass.
 *   3. Honeypot — hidden field must be empty.
 *   4. create_order_v1 — one database transaction that re-reads prices,
 *      checks stock, decrements it and writes the order. A retry with the
 *      same idempotency key returns the original order.
 *
 * Notifications (owner + customer email via Resend) run AFTER the order is
 * committed — an email failure never loses an order (it is recorded in
 * order_events instead).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The order payload the checkout success screen is allowed to see. */
function toClientOrder(order: DbOrder): ClientOrder {
  return {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    area: order.area,
    items: order.items.map((i) => ({
      productName: i.product_name,
      optionLabel: i.option_label,
      quantity: i.quantity,
      unitPriceKes: i.unit_price_kes,
      lineTotalKes: i.line_total_kes,
    })),
    subtotalKes: order.subtotal_kes,
    deliveryFeeKes: order.delivery_fee_kes,
    totalKes: order.total_kes,
    paymentMethod: order.payment_method,
  };
}

function httpStatusFor(code: string): number {
  if (code === "insufficient_stock" || code === "duplicate_in_progress") {
    return 409;
  }
  if (code === "database_unreachable") return 503;
  return 400;
}

/** Friendly, specific messages for the failure codes create_order_v1 returns. */
function friendlyMessage(outcome: {
  code: string;
  message?: string;
  option_label?: string;
  available?: number;
}): string {
  if (outcome.code === "insufficient_stock") {
    const label = outcome.option_label ?? "that size";
    if ((outcome.available ?? 0) === 0) {
      return `${label} is out of stock right now. Please choose another size or order on WhatsApp.`;
    }
    return `Only ${outcome.available} left of ${label.toLowerCase()}. Please reduce the quantity to ${outcome.available} or choose another size.`;
  }
  if (outcome.code === "duplicate_in_progress") {
    return "Your order is already being placed — please wait a moment.";
  }
  if (outcome.code === "database_unreachable") {
    return "We could not place your order right now. Please try again in a moment, or order on WhatsApp.";
  }
  return outcome.message ?? "We could not place your order. Please try again.";
}

export async function POST(req: NextRequest) {
  // 1. Rate limit (per IP).
  const ip = clientIp(req);
  if (!checkOrderRateLimit(ip)) {
    return NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        message:
          "Too many orders from your network in a short time. Please wait a few minutes, or order on WhatsApp.",
      },
      { status: 429 }
    );
  }

  // 2. Parse + strict validation.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_failed",
        message: "We could not read your order. Please refresh the page and try again.",
      },
      { status: 400 }
    );
  }

  const parsed = OrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_failed",
        message: "Please check the highlighted fields and try again.",
        errors: zodFieldErrors(parsed.error),
      },
      { status: 400 }
    );
  }

  // 3. Honeypot — bots fill hidden fields.
  if (parsed.data.companyWebsite.trim().length > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "We could not place your order. Please refresh the page and try again.",
      },
      { status: 400 }
    );
  }

  // 4. Atomic order creation (stock check + decrement + order in ONE
  //    transaction; idempotent under retries).
  const outcome = await createOrderInDb(buildOrderPayload(parsed.data));
  if (!outcome.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: outcome.code,
        message: friendlyMessage(outcome),
        ...(outcome.code === "insufficient_stock"
          ? { available: outcome.available ?? 0, optionLabel: outcome.option_label ?? null }
          : {}),
      },
      { status: httpStatusFor(outcome.code) }
    );
  }

  // 5. Notifications AFTER the order is committed — failures are recorded
  //    in order_events and never lose the order.
  await sendOrderNotifications(outcome.order);

  return NextResponse.json(
    { ok: true, order: toClientOrder(outcome.order) },
    { status: 201 }
  );
}
