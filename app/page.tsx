import type { Metadata } from "next";
import LandingHero from "@/components/sections/LandingHero";
import StepsSection from "@/components/sections/StepsSection";
import ProductsSection from "@/components/sections/ProductsSection";
import WelcomeIntro from "@/components/WelcomeIntro";
import CheckoutLazy from "@/components/sections/CheckoutLazy";
import { getCatalogue } from "@/lib/server/catalogue";

/**
 * STEP 4A — the catalogue now comes from the DATABASE (server-side, cached
 * with revalidation). If the database is unreachable, getCatalogue() falls
 * back to lib/products.ts so this page never breaks.
 *
 * The checkout section is loaded lazily through the CheckoutLazy client
 * wrapper (see there) to keep the initial landing-page bundle light.
 */

export const metadata: Metadata = {
  title: "Lake Flavour — Order Fried Omena Online in Nairobi",
  description:
    "Premium Fried Omena from Lake Victoria. Order online — fresh, crispy, delivered within Nairobi. Pay on delivery with cash or M-Pesa.",
};

/** Revalidate the database-backed catalogue every 5 minutes. */
export const revalidate = 300;

export default async function Home() {
  const { products } = await getCatalogue();

  return (
    <main className="relative w-full bg-background">
      {/* FEATURE A: one-per-session blur welcome intro overlay */}
      <WelcomeIntro />
      {/* FEATURE B: full-screen auto-advancing landing slides */}
      <LandingHero />
      {/* STEP 2: floating cooking-steps viewer ("Explore" scrolls here) */}
      <StepsSection />
      {/* STEP 3: product listing with WhatsApp ordering (data from the database) */}
      <ProductsSection products={products} />
      {/* STEP 4A: online checkout (pay on delivery; #order anchor) */}
      <CheckoutLazy products={products} />
    </main>
  );
}
