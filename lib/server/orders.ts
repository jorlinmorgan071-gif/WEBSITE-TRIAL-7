import "server-only";

/**
 * STEP 4A — order service used by the API route and the admin dashboard.
 * Wraps the database driver with the friendly failure mapping, so a database
 * outage can never produce a crash — only a clear message.
 */

import { getDb, type CreateOrderOutcome, type CreateOrderPayload, type DbOrder, type SetOrderStatusOutcome } from "./db";

/** Create an order atomically via create_order_v1. Never throws. */
export async function createOrderInDb(
  payload: CreateOrderPayload
): Promise<CreateOrderOutcome> {
  try {
    return await getDb().createOrder(payload);
  } catch (error) {
    console.error(
      "[orders] create_order_v1 failed:",
      error instanceof Error ? error.message : error
    );
    return {
      ok: false,
      code: "database_unreachable",
      message: "We could not place your order right now.",
    };
  }
}

/** Newest orders first (owner dashboard). Throws on database failure — the admin page shows an error panel. */
export async function listRecentOrders(limit = 50): Promise<DbOrder[]> {
  return getDb().listRecentOrders(limit);
}

/** Owner status change via set_order_status_v1. Never throws. */
export async function setOrderStatusInDb(
  orderId: string,
  newStatus: string,
  note: string | null
): Promise<SetOrderStatusOutcome> {
  try {
    return await getDb().setOrderStatus(orderId, newStatus, note);
  } catch (error) {
    console.error(
      "[orders] set_order_status_v1 failed:",
      error instanceof Error ? error.message : error
    );
    return {
      ok: false,
      code: "database_unreachable",
      message: "We could not reach the database to update the order.",
    };
  }
}
