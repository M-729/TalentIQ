import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { AiTrustSection } from "@/components/landing/AiTrustSection";
import { TeamWorkspaceSection } from "@/components/landing/TeamWorkspaceSection";
import { AnalyticsPreviewSection } from "@/components/landing/AnalyticsPreviewSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

// The public TalentIQ marketing/landing page at "/" — outside
// ProtectedRoute/AppShell, no authenticated sidebar, reusing the same
// BrandMark PublicHeader uses everywhere else on the public site. Never
// redesigns the authenticated app (Dashboard/Jobs/Applications/etc.) —
// this ticket is scoped to the public site only.
export function LandingPage() {
  return (
    <div className="public-brand-theme min-h-svh bg-background">
      <LandingNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <AiTrustSection />
        <TeamWorkspaceSection />
        <AnalyticsPreviewSection />
        <SecuritySection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
