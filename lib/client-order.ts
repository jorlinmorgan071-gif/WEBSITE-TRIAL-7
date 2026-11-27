/**
 * STEP 4A — the order shape shown on the checkout success screen.
 * Client-safe (no server imports): it carries no internal fields, only what
 * the customer just submitted plus values the server calculated.
 */

import type { BusinessInfo } from "./business";
import { formatPrice } from "./order";

export interface ClientOrderItem {
  productName: string;
  optionLabel: string;
  quantity: number;
  unitPriceKes: number;
  lineTotalKes: number;
}

export interface ClientOrder {
  orderNumber: string;
  customerName: string;
  area: string;
  items: ClientOrderItem[];
  subtotalKes: number;
  deliveryFeeKes: number | null;
  totalKes: number | null;
  paymentMethod: string;
}

/** "KES 800 (delivery included)" / "KES 800 + delivery fee to confirm". */
export function totalLine(
  order: Pick<ClientOrder, "subtotalKes" | "deliveryFeeKes" | "totalKes">,
  currency = "KES"
): string {
  if (order.totalKes !== null) {
    return `${formatPrice(order.totalKes, currency)} (delivery included)`;
  }
  return `${formatPrice(order.subtotalKes, currency)} + delivery fee to confirm`;
}

/**
 * Prefilled WhatsApp message for the success screen: order number, items,
 * customer name and area. Built from the same inputs every time so the
 * message can never disagree with the order.
 */
export function successWhatsappMessage(
  business: BusinessInfo,
  order: ClientOrder
): string {
  const lines = order.items
    .map(
      (i) =>
        `${i.quantity} × ${i.productName} (${i.optionLabel}) — ${formatPrice(
          i.lineTotalKes,
          business.currency
        )}`
    )
    .join("\n");
  return [
    `Hello ${business.name}! I placed order ${order.orderNumber} on your website.`,
    lines,
    `Name: ${order.customerName}`,
    `Area: ${order.area}`,
    `Total: ${totalLine(order, business.currency)}`,
  ].join("\n");
}
