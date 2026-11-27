/**
 * STEP 4A — payment methods offered at checkout.
 *
 * Single source of truth for the checkout radio group AND the server-side
 * validation. Step 4D adds "Pay now with M-Pesa": flip `available` to true
 * there and the form, validation and admin UI all pick it up.
 */

export type PaymentMethodId = "pay_on_delivery" | "mpesa_pay_now";

export interface PaymentMethodInfo {
  /** Value stored in orders.payment_method. */
  id: PaymentMethodId;
  /** Label shown in the checkout radio group. */
  label: string;
  /** One-line explanation under the label. */
  description: string;
  /** false renders the option as "coming soon" and cannot be chosen. */
  available: boolean;
}

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  {
    id: "pay_on_delivery",
    label: "Pay on delivery (cash or M-Pesa)",
    description: "Pay in cash, or by M-Pesa, when your order arrives.",
    available: true,
  },
  {
    id: "mpesa_pay_now",
    label: "Pay now with M-Pesa",
    description: "Coming soon — pay online when you place the order.",
    available: false,
  },
];

/** All ids the API accepts (including future ones, so 4D is one flag away). */
export const PAYMENT_METHOD_IDS: PaymentMethodId[] = PAYMENT_METHODS.map(
  (m) => m.id
);

/** The ids a customer can actually choose right now. */
export const AVAILABLE_PAYMENT_METHOD_IDS: PaymentMethodId[] =
  PAYMENT_METHODS.filter((m) => m.available).map((m) => m.id);

export function paymentMethodLabel(id: string): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
}
