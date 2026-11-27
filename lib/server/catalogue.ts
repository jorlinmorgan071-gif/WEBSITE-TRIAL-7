import "server-only";

/**
 * STEP 4A — catalogue data source.
 * The products section now reads from the database (one source of truth),
 * cached at the page level with revalidation. lib/products.ts stays as a
 * FALLBACK that is used only when the database is unreachable or empty, so
 * the landing page never breaks.
 */

import { PRODUCTS, type Product } from "@/lib/products";
import { getDb, type DbProduct } from "./db";

export interface CatalogueResult {
  products: Product[];
  source: "database" | "fallback";
}

/** Map a database product row onto the Step 3 Product shape (components stay unchanged). */
function mapDbProduct(row: DbProduct): Product {
  const options = row.options
    .filter((o) => o.is_active)
    .map((o) => ({
      id: o.id, // option uuid — this is what the checkout submits
      label: o.label,
      localName: o.local_name,
      priceKes: o.price_kes,
    }));
  // A product is orderable while at least one active option is available.
  // stock_quantity null means "not tracked" (always available).
  const inStock = row.options.some(
    (o) => o.is_active && (o.stock_quantity === null || o.stock_quantity > 0)
  );
  return {
    id: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    highlights: row.highlights ?? [],
    badge: row.badge,
    inStock,
    options,
    defaultOptionId: options[0]?.id ?? "",
    images: row.images ?? [],
  };
}

export async function getCatalogue(): Promise<CatalogueResult> {
  try {
    const rows = await getDb().getActiveProducts();
    if (rows.length === 0) {
      throw new Error("catalogue is empty");
    }
    return { products: rows.map(mapDbProduct), source: "database" };
  } catch (error) {
    // The database is unreachable or empty — render the fallback catalogue so
    // the page never breaks. Orders cannot be placed in this state (the API
    // returns a friendly error and the WhatsApp button still works).
    console.warn(
      "[catalogue] database unavailable — using lib/products.ts fallback:",
      error instanceof Error ? error.message : String(error)
    );
    return { products: PRODUCTS, source: "fallback" };
  }
}
