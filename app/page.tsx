import LandingHero from "@/components/sections/LandingHero";
import StepsSection from "@/components/sections/StepsSection";
import ProductsSection from "@/components/sections/ProductsSection";
import OrderPlaceholder from "@/components/sections/OrderPlaceholder";
import WelcomeIntro from "@/components/WelcomeIntro";

export default function Home() {
  return (
    <main className="relative w-full bg-background">
      {/* FEATURE A: one-per-session blur welcome intro overlay */}
      <WelcomeIntro />
      {/* FEATURE B: full-screen auto-advancing landing slides */}
      <LandingHero />
      {/* STEP 2: floating cooking-steps viewer ("Explore" scrolls here) */}
      <StepsSection />
      {/* STEP 3: product listing with WhatsApp ordering */}
      <ProductsSection />
      {/* Step 4 stub: online ordering and payment (target of "Order online") */}
      <OrderPlaceholder />
    </main>
  );
}
