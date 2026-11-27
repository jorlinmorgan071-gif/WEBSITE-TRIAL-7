/**
 * STEP 4A — Nairobi delivery areas.
 *
 * Single source of truth for the checkout area picker AND the server-side
 * validation. deliveryFeeKes is null everywhere for now: the fee is
 * confirmed when the business contacts the customer, so the checkout must
 * never invent or imply a fee. When the owner sets real fees, fill the
 * number in here (e.g. deliveryFeeKes: 200) and the checkout shows it.
 */

export interface DeliveryArea {
  /** Stable id, e.g. "kilimani". */
  id: string;
  /** Name shown in the list and stored in orders.area. */
  name: string;
  /** Delivery fee in KES, or null = "confirmed when we contact you". */
  deliveryFeeKes: number | null;
}

export const DELIVERY_AREAS: DeliveryArea[] = [
  { id: "nairobi-cbd", name: "Nairobi CBD", deliveryFeeKes: null },
  { id: "upper-hill", name: "Upper Hill", deliveryFeeKes: null },
  { id: "westlands", name: "Westlands", deliveryFeeKes: null },
  { id: "parklands", name: "Parklands", deliveryFeeKes: null },
  { id: "highridge", name: "Highridge", deliveryFeeKes: null },
  { id: "spring-valley", name: "Spring Valley", deliveryFeeKes: null },
  { id: "muthaiga", name: "Muthaiga", deliveryFeeKes: null },
  { id: "runda", name: "Runda", deliveryFeeKes: null },
  { id: "kileleshwa", name: "Kileleshwa", deliveryFeeKes: null },
  { id: "kilimani", name: "Kilimani", deliveryFeeKes: null },
  { id: "lavington", name: "Lavington", deliveryFeeKes: null },
  { id: "valley-arcade", name: "Valley Arcade", deliveryFeeKes: null },
  { id: "hardy", name: "Hardy", deliveryFeeKes: null },
  { id: "dagoretti-corner", name: "Dagoretti Corner", deliveryFeeKes: null },
  { id: "ngando", name: "Ngando", deliveryFeeKes: null },
  { id: "kawangware", name: "Kawangware", deliveryFeeKes: null },
  { id: "kangemi", name: "Kangemi", deliveryFeeKes: null },
  { id: "south-b", name: "South B", deliveryFeeKes: null },
  { id: "south-c", name: "South C", deliveryFeeKes: null },
  { id: "langata", name: "Langata", deliveryFeeKes: null },
  { id: "karen", name: "Karen", deliveryFeeKes: null },
  { id: "nairobi-west", name: "Nairobi West", deliveryFeeKes: null },
  { id: "madaraka", name: "Madaraka", deliveryFeeKes: null },
  { id: "imara-daima", name: "Imara Daima", deliveryFeeKes: null },
  { id: "embakasi", name: "Embakasi", deliveryFeeKes: null },
  { id: "donholm", name: "Donholm", deliveryFeeKes: null },
  { id: "umoja", name: "Umoja", deliveryFeeKes: null },
  { id: "buruburu", name: "Buruburu", deliveryFeeKes: null },
  { id: "makadara", name: "Makadara", deliveryFeeKes: null },
  { id: "jericho", name: "Jericho", deliveryFeeKes: null },
  { id: "eastleigh", name: "Eastleigh", deliveryFeeKes: null },
  { id: "ngara", name: "Ngara", deliveryFeeKes: null },
  { id: "pangani", name: "Pangani", deliveryFeeKes: null },
  { id: "kasarani", name: "Kasarani", deliveryFeeKes: null },
  { id: "roysambu", name: "Roysambu", deliveryFeeKes: null },
  { id: "zimmerman", name: "Zimmerman", deliveryFeeKes: null },
  { id: "githurai", name: "Githurai", deliveryFeeKes: null },
  { id: "kahawa-west", name: "Kahawa West", deliveryFeeKes: null },
  { id: "ruaka", name: "Ruaka", deliveryFeeKes: null },
];

/** Stored in orders.area when the customer picks "Other". */
export const OTHER_AREA = "Other";

/** Names the API accepts for `area`. */
export const ALLOWED_AREA_NAMES: string[] = [
  ...DELIVERY_AREAS.map((a) => a.name),
  OTHER_AREA,
];

/** "Delivery fee confirmed when we contact you" line for an area. */
export function deliveryFeeText(area: DeliveryArea | null): string {
  if (area && area.deliveryFeeKes !== null) {
    return `Delivery fee: KES ${area.deliveryFeeKes.toLocaleString("en-KE")}`;
  }
  return "Delivery fee confirmed when we contact you";
}
