import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section className="bg-sidebar">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-white">Ready to simplify your hiring workflow?</h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/signup">Create your TalentIQ workspace</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-sidebar-border bg-transparent text-white hover:bg-sidebar-accent hover:text-white"
          >
            <Link to="/careers">Browse open positions</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
