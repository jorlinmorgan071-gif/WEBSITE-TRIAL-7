/**
 * STEP 4A — order status metadata (shared by the admin UI and unit tests).
 * Pure data and formatting only, so plain Node can test it too.
 */

export type OrderStatus =
  | "new"
  | "confirmed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/** Human labels shown in the owner dashboard. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Tailwind classes for each status badge (existing tokens only). */
export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  new: "border-gold/50 bg-gold/15 text-gold-light",
  confirmed: "border-gold-light/50 bg-gold-light/10 text-gold-light",
  out_for_delivery: "border-cream/40 bg-cream/10 text-cream",
  delivered: "border-cream/30 bg-surface text-muted",
  cancelled: "border-cream/15 bg-transparent text-muted line-through",
};

/**
 * Allowed status transitions — mirrors set_order_status_v1 in migration
 * 0003: new -> confirmed -> out_for_delivery -> delivered, or cancelled.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

/**
 * Button label for moving an order TO a given status (keyed by the TARGET
 * status, matching how OrderCard looks it up: new -> confirmed -> …).
 */
export const STATUS_ACTION_LABELS: Record<OrderStatus, string> = {
  new: "", // nothing moves an order back to "new"
  confirmed: "Confirm order",
  out_for_delivery: "Mark out for delivery",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};

/**
 * Format an order's created_at in Nairobi time, e.g.
 * "27 Nov 2026, 3:45 PM". Falls back to ISO when Intl lacks the timezone.
 */
export function formatNairobiDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}
