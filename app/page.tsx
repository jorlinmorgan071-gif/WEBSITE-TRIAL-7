import LandingHero from "@/components/sections/LandingHero";
import NextSection from "@/components/sections/NextSection";
import WelcomeIntro from "@/components/WelcomeIntro";

export default function Home() {
  return (
    <main className="relative w-full bg-background">
      {/* FEATURE A: one-per-session blur welcome intro overlay */}
      <WelcomeIntro />
      {/* FEATURE B: full-screen auto-advancing landing slides */}
      <LandingHero />
      {/* Placeholder so the hero scroll-fade can be tested */}
      <NextSection />
    </main>
  );
}
