/**
 * STEP 3 — Lake Flavour business details.
 * Single source of truth for contact and social information used across
 * the products section and (later) the online order flow.
 *
 * EDITING GUIDE (no code knowledge needed):
 * - "whatsapp" is the number the order links open: international format,
 *   digits only (no +, spaces or dashes), e.g. 254XXXXXXXXX.
 * - "displayPhone" is how the number reads on screen (local format).
 * - "currency" is shown before every price on the site.
 * - "social": paste the FULL profile link (https://...) once the handle is
 *   confirmed with the owner. Leave a value as "" to hide that icon —
 *   icons render only for non-empty values.
 */

/** Contact and identity details for the shop. */
export interface BusinessInfo {
  /** Shop name — also opens the WhatsApp order message. */
  name: string;
  /** WhatsApp number for order links (international, digits only). */
  whatsapp: string;
  /** How the phone number is shown on screen. */
  displayPhone: string;
  /** Currency shown before every price. */
  currency: string;
  /** Social profile links — an empty string ("") hides that icon. */
  social: {
    tiktok: string;
    instagram: string;
    facebook: string;
  };
}

export const BUSINESS: BusinessInfo = {
  name: "Lake Flavour",
  whatsapp: "254768859022",
  displayPhone: "0768 859 022",
  currency: "KES",
  // TODO: confirm the handles with the owner — icons stay hidden
  // until each link is filled in.
  social: {
    tiktok: "",
    instagram: "",
    facebook: "",
  },
};
