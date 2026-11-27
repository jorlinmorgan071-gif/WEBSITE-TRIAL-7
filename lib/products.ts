/**
 * STEP 3 — product catalogue.
 * Single source of truth for everything shown in the products section.
 *
 * EDITING GUIDE (no code knowledge needed):
 * - Everything on the page comes from this file: change the text between
 *   the quotes and the site updates. Keep the commas and quotes as they are.
 * - One product shows the big featured showcase. Two or more products
 *   switch the section to a product grid automatically — add a product by
 *   copying a whole { ... } block, changing its content, and adding it to
 *   the list.
 * - "badge": null, or a short label such as "Best Seller" or "New".
 * - "inStock": true shows "In stock" and live order buttons; false shows
 *   "Out of stock" and disables both order buttons.
 * - "options" are the sizes buyers choose between. "label" is the formal
 *   size, "localName" the everyday name shown next to it. "priceKes" is a
 *   plain number — thousands separators (1,200) are added automatically.
 * - "images": two or more photos show thumbnails under the main photo.
 *   "src" is a file path from /public/images/...; "alt" describes the
 *   photo for screen readers.
 */

/** One purchasable size of a product. */
export interface ProductOption {
  /** Stable id used in code, e.g. "1kg". */
  id: string;
  /** Formal size label, e.g. "1 kg". */
  label: string;
  /** Everyday name shown beside the label, e.g. "Half gorogoro". */
  localName: string;
  /** Price in Kenyan shillings, digits only. */
  priceKes: number;
}

/** One product photo. */
export interface ProductImage {
  /** Path from /public, e.g. "/images/products/fried-omena-1.jpg". */
  src: string;
  /** What screen readers should say about the photo. */
  alt: string;
}

/** One product, exactly as shown in the products section. */
export interface Product {
  /** Stable id / slug, e.g. "fried-omena". */
  id: string;
  /** Serif product name. */
  name: string;
  /** Short gold line under the name. */
  tagline: string;
  /** Full description paragraph. */
  description: string;
  /** Short bullet lines under the description. */
  highlights: string[];
  /** Corner label such as "Best Seller" / "New", or null for none. */
  badge: string | null;
  /** false shows "Out of stock" and disables the order buttons. */
  inStock: boolean;
  /** Sizes buyers choose between. */
  options: ProductOption[];
  /** Which option is selected when the page loads. */
  defaultOptionId: string;
  /** Photos of the product. */
  images: ProductImage[];
}

/** Section header, above the showcase / grid. */
export const PRODUCTS_EYEBROW = "Our Product";
export const PRODUCTS_HEADING = "Get Your Fried Omena";
export const PRODUCTS_SUBHEADING =
  "Fresh from the lake, fried in vegetable oil, and ready when you are.";

export const PRODUCTS: Product[] = [
  {
    id: "fried-omena",
    name: "Fried Omena",
    tagline: "Fresh from Lake Victoria",
    description:
      "Fresh fried omena from Lake Victoria, washed to remove stones and shell, fried in fresh vegetable oil and prepared to your taste.",
    highlights: [
      "Sourced from Lake Victoria",
      "Washed to remove stones and shell",
      "Fried in fresh vegetable oil",
      "Prepared to your taste",
    ],
    badge: null,
    inStock: true,
    options: [
      { id: "1kg", label: "1 kg", localName: "Half gorogoro", priceKes: 400 },
      { id: "2kg", label: "2 kg", localName: "1 gorogoro", priceKes: 800 },
    ],
    defaultOptionId: "1kg",
    // TODO: replace with real product photos — these reuse the Step 1
    // landing images as temporary placeholders.
    images: [
      {
        src: "/images/landing/hero-1.webp",
        alt: "A bag of Lake Flavour fried omena standing on a wooden board",
      },
      {
        src: "/images/landing/hero-5.webp",
        alt: "Bag of fried omena with a chef, knife and chillies in the kitchen",
      },
    ],
  },
];
