import LandingHero from "@/components/sections/LandingHero";
import NextSection from "@/components/sections/NextSection";
import StepsSection from "@/components/sections/StepsSection";
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
      {/* Placeholder so the page keeps scrolling after the steps */}
      <NextSection />
    </main>
  );
}
