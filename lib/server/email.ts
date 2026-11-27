import "server-only";

/**
 * STEP 4A — order notifications via Resend.
 *
 * RULES IMPLEMENTED HERE:
 *   * The owner email (OWNER_EMAIL) is sent for every new order.
 *   * The customer confirmation email is sent ONLY while
 *     RESEND_SEND_TO_CUSTOMERS=true (i.e. once a verified sending domain
 *     allows emailing arbitrary customers). Otherwise it is skipped and the
 *     skip is logged.
 *   * Email failures NEVER lose an order: the order is already committed
 *     when this runs, and every failure is recorded in order_events
 *     (type "notification_failed") so the owner can resend manually.
 *   * The API base URL is configurable (RESEND_API_BASE_URL) so tests can
 *     point it at a local mock.
 */

import { BUSINESS } from "@/lib/business";
import { formatPrice } from "@/lib/order";
import { paymentMethodLabel } from "@/lib/payment";
import { getServerEnv } from "./env";
import { getDb, type DbOrder } from "./db";

interface EmailJob {
  to: string;
  subject: string;
  text: string;
}

async function sendViaResend(
  job: EmailJob
): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = getServerEnv();
  if (!env.resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  try {
    const res = await fetch(`${env.resendBaseUrl}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.resendApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.resendFrom,
        to: [job.to],
        subject: job.subject,
        text: job.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend responded ${res.status}: ${body.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Record an order event; never throws (a logging failure must not break checkout). */
async function recordEvent(
  orderId: string,
  type: string,
  note: string
): Promise<void> {
  try {
    await getDb().insertOrderEvent(orderId, type, note);
  } catch (error) {
    console.error(`[email] could not record ${type} event:`, error instanceof Error ? error.message : error);
  }
}

function itemsLines(order: DbOrder): string {
  return order.items
    .map(
      (i) =>
        `- ${i.quantity} × ${i.product_name} (${i.option_label}) — ${formatPrice(
          i.line_total_kes,
          BUSINESS.currency
        )}`
    )
    .join("\n");
}

function ownerEmailJob(order: DbOrder): EmailJob {
  const env = getServerEnv();
  const total =
    order.total_kes !== null
      ? `${formatPrice(order.total_kes, BUSINESS.currency)} (delivery included)`
      : `${formatPrice(order.subtotal_kes, BUSINESS.currency)} + delivery fee to confirm`;
  return {
    to: env.ownerEmail as string,
    subject: `New order ${order.order_number} — ${formatPrice(order.subtotal_kes, BUSINESS.currency)}`,
    text: [
      `New Lake Flavour order ${order.order_number}`,
      ``,
      `Customer: ${order.customer_name}`,
      `Phone: +${order.phone}`,
      order.email ? `Email: ${order.email}` : null,
      `Area: ${order.area}`,
      `Address: ${order.address_details}`,
      order.notes ? `Notes: ${order.notes}` : null,
      ``,
      `Items:`,
      itemsLines(order),
      `Subtotal: ${formatPrice(order.subtotal_kes, BUSINESS.currency)}`,
      `Total: ${total}`,
      ``,
      `Payment: ${paymentMethodLabel(order.payment_method)} (${order.payment_status})`,
      `Status: ${order.status}`,
      ``,
      `Open the order: ${env.siteUrl}/admin/orders`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  };
}

function customerEmailJob(order: DbOrder): EmailJob {
  const delivery =
    order.total_kes !== null
      ? `Total: ${formatPrice(order.total_kes, BUSINESS.currency)}`
      : `Delivery fee: confirmed when we contact you`;
  return {
    to: order.email as string,
    subject: `Your Lake Flavour order ${order.order_number}`,
    text: [
      `Thank you for your Lake Flavour order!`,
      ``,
      `Order number: ${order.order_number}`,
      ``,
      `Items:`,
      itemsLines(order),
      `Subtotal: ${formatPrice(order.subtotal_kes, BUSINESS.currency)}`,
      delivery,
      ``,
      `Payment: ${paymentMethodLabel(order.payment_method)}.`,
      `We will contact you on WhatsApp or phone to confirm delivery.`,
      ``,
      `${BUSINESS.name} — Crisp. Golden. Straight from the lake.`,
    ].join("\n"),
  };
}

/** Called AFTER an order is committed. Never throws. */
export async function sendOrderNotifications(order: DbOrder): Promise<void> {
  const env = getServerEnv();

  // ---- owner notification ------------------------------------------------
  if (!env.ownerEmail) {
    console.warn("[email] OWNER_EMAIL is not configured — no owner notification");
    await recordEvent(order.id, "notification_skipped", "Owner email skipped: OWNER_EMAIL is not configured.");
  } else {
    const result = await sendViaResend(ownerEmailJob(order));
    if (result.ok) {
      console.log(`[email] owner notification sent for ${order.order_number}`);
    } else {
      console.error(`[email] owner notification FAILED for ${order.order_number}: ${result.error}`);
      await recordEvent(order.id, "notification_failed", `Owner email failed. ${result.error}`.slice(0, 300));
    }
  }

  // ---- customer confirmation ----------------------------------------------
  if (!order.email) return;
  if (!env.resendSendToCustomers) {
    console.log(
      `[email] customer email skipped for ${order.order_number} — no verified sending domain configured (set RESEND_SEND_TO_CUSTOMERS=true once verified)`
    );
    return;
  }
  const result = await sendViaResend(customerEmailJob(order));
  if (result.ok) {
    console.log(`[email] customer confirmation sent for ${order.order_number}`);
  } else {
    console.error(`[email] customer email FAILED for ${order.order_number}: ${result.error}`);
    await recordEvent(order.id, "notification_failed", `Customer email failed. ${result.error}`.slice(0, 300));
  }
}
