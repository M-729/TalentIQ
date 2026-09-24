import { CheckCircle2 } from "lucide-react";

const PRINCIPLES = [
  "AI screening summarizes CV/job fit for HR to review — it never rejects a candidate automatically.",
  "AI never hires a candidate automatically.",
  "HR controls every stage of the workflow.",
  "AI never moves a candidate through the pipeline without HR action.",
];

// A deliberately factual trust section — no "AI magic" language, no
// performance claims (see this ticket's explicit rules). States the
// actual product boundary: AI assists, HR decides.
export function AiTrustSection() {
  return (
    <section className="bg-sidebar">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-white">AI assists. Your team decides.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sidebar-foreground/80">
          TalentIQ's AI screening is a review aid for HR, not an autonomous decision-maker.
        </p>

        <ul className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <li key={principle} className="flex items-start gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span className="text-sm text-sidebar-foreground/90">{principle}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
