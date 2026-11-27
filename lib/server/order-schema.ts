import "server-only";

/**
 * STEP 4A — order request schema (zod) and payload builder.
 * Server-only: the API route validates EVERY field here — lengths, formats,
 * quantities, allowed areas and allowed payment methods — and .strict()
 * rejects any unknown field, so a tampered client payload (e.g. injected
 * prices) never reaches the database. Prices are re-read inside
 * create_order_v1 regardless.
 */

import { z } from "zod";
import { ALLOWED_AREA_NAMES } from "@/lib/delivery";
import { PAYMENT_METHOD_IDS } from "@/lib/payment";
import { normaliseKenyanPhone } from "@/lib/phone";
import type { CreateOrderPayload } from "./db";

/** Kenyan mobile number → normalised 254XXXXXXXXX (see lib/phone.ts). */
const phoneField = z
  .string()
  .trim()
  .min(1, "Enter your phone number, e.g. 0712 345 678.")
  .transform(normaliseKenyanPhone)
  .refine((v): v is string => v !== null, "Enter a valid Kenyan phone number, e.g. 0712 345 678.");

export const OrderRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(80, "Keep your name under 80 characters."),
    phone: phoneField,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address, e.g. you@example.com.")
      .max(120, "Keep your email under 120 characters."),
    area: z
      .string()
      .trim()
      .min(1, "Choose your Nairobi area or estate.")
      .refine(
        (v) => ALLOWED_AREA_NAMES.includes(v),
        "Choose an area from the list, or pick Other."
      ),
    addressDetails: z
      .string()
      .trim()
      .min(4, "Add your building or house and a landmark.")
      .max(200, "Keep the address under 200 characters."),
    notes: z.string().trim().max(300, "Keep notes under 300 characters.").optional().default(""),
    consent: z.literal(true, {
      errorMap: () => ({ message: "Please agree to the Privacy Notice to continue." }),
    }),
    paymentMethod: z
      .enum(PAYMENT_METHOD_IDS as [string, ...string[]])
      .refine(
        (v) => v === "pay_on_delivery",
        "Pay now with M-Pesa is coming soon — please choose pay on delivery."
      ),
    items: z
      .array(
        z
          .object({
            optionId: z.string().uuid("Choose a size."),
            quantity: z
              .number()
              .int("Quantity must be a whole number.")
              .min(1, "Quantity must be at least 1.")
              .max(10, "For more than 10 bags, please order on WhatsApp."),
          })
          .strict() // unknown fields inside an item (e.g. injected prices) are rejected
      )
      .min(1, "Choose a size and quantity.")
      .max(10, "Please place up to 10 items per order."),
    idempotencyKey: z.string().trim().min(8).max(64),
    /** Honeypot — must stay empty. Non-empty values are rejected by the route. */
    companyWebsite: z.string().max(200).optional().default(""),
  })
  .strict();

export type OrderRequest = z.infer<typeof OrderRequestSchema>;

/** Build the snake_case payload for create_order_v1. */
export function buildOrderPayload(data: OrderRequest): CreateOrderPayload {
  return {
    customer: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      area: data.area,
      address_details: data.addressDetails,
      notes: data.notes ? data.notes : null,
      consent_given: data.consent,
      payment_method: data.paymentMethod,
    },
    items: data.items.map((i) => ({ option_id: i.optionId, quantity: i.quantity })),
    delivery_fee_kes: null, // confirmed when the business contacts the customer
    idempotency_key: data.idempotencyKey,
  };
}

/** zod issues → { field: message } for the checkout form. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
