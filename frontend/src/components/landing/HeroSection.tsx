import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductPreviewSection } from "@/components/landing/ProductPreviewSection";

// Grounded product language throughout — no "revolutionize", no "10x", no
// guaranteed outcomes (see this ticket's explicit copy-style rule).
export function HeroSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Hire smarter. Move candidates forward with confidence.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            TalentIQ helps hiring teams manage jobs, applications, AI-assisted CV screening, interviews, assessments,
            offers, and hiring decisions in one secure workspace.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/signup">Start Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/careers">Browse Open Jobs</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">No candidate account required.</p>
        </div>

        <div className="mt-16">
          <ProductPreviewSection />
        </div>
      </div>
    </section>
  );
}
