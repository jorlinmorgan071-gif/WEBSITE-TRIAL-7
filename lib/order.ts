/**
 * STEP 3 — order helpers shared by the product section.
 * Pure functions: the same inputs always build the same message, so the
 * WhatsApp link can never disagree with the size and price on screen.
 * Checked with plain assertions in scripts/check_step3_helpers.mjs.
 */

import type { BusinessInfo } from "./business";
import type { Product, ProductOption } from "./products";

/** Group digits with commas: 1200 -> "1,200". Deterministic everywhere —
 *  no locale support needed on the server or the client. */
export function formatThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Price as shown on screen: 400 -> "KES 400", 1200 -> "KES 1,200". */
export function formatPrice(amountKes: number, currency = "KES"): string {
  return `${currency} ${formatThousands(amountKes)}`;
}

/** WhatsApp order message for one product at a chosen size. */
export function orderMessage(
  business: BusinessInfo,
  product: Product,
  option: ProductOption
): string {
  return `Hello ${business.name}! I would like to order ${
    product.name
  } - ${option.label} (${formatPrice(option.priceKes, business.currency)}).`;
}

/** wa.me link that opens the WhatsApp chat with the message pre-filled. */
export function whatsappUrl(business: BusinessInfo, message: string): string {
  return `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
    message
  )}`;
}

/** tel: link for the shop number (international form dials from abroad). */
export function telHref(business: BusinessInfo): string {
  return `tel:+${business.whatsapp}`;
}
