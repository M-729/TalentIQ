import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section className="bg-[#121a33]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
        <div className="max-w-3xl">
          <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-[#b7aeff]">Build your workspace</p>
          <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">Build a better hiring process with TalentIQ.</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#c1c8df]">Manage your hiring workflow from application to final decision in one secure workspace.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-lg bg-[#6c5ce7] px-6 text-base hover:bg-[#7a6df0]"><Link to="/signup">Create your TalentIQ workspace <ArrowRight className="size-4" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-lg border-[#3a476d] bg-transparent px-6 text-base text-white hover:bg-[#202b4d] hover:text-white"><Link to="/careers">Browse open positions</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
