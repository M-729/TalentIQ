import { CheckCircle2, Sparkles } from "lucide-react";

const PRINCIPLES = [
  "AI screening summarizes CV and job fit for HR to review.",
  "AI never rejects a candidate automatically and never hires a candidate automatically.",
  "HR controls every movement through the hiring workflow.",
];

export function AiTrustSection() {
  return (
    <section className="overflow-hidden bg-[#121a33]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12 xl:px-16">
        <div>
          <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-[#b7aeff]">Thoughtful AI, grounded decisions</p>
          <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-[-0.035em] text-white sm:text-4xl">AI assists. Your team decides.</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#c1c8df]">TalentIQ turns CV and job-fit information into a clearer review starting point. It does not make hiring decisions for you.</p>
          <ul className="mt-8 space-y-4">
            {PRINCIPLES.map((principle) => (
              <li key={principle} className="flex items-start gap-3 text-sm leading-relaxed text-[#e4e7f5]">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#a99eff]" aria-hidden="true" />
                {principle}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-xl rounded-xl border border-[#313d62] bg-[#1a2444] p-3 shadow-[0_22px_50px_rgba(0,0,0,0.24)]" aria-hidden="true">
          <div className="rounded-lg bg-[#f8f9fd] p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[#e4e7ee] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#e9e6ff] text-primary"><Sparkles className="size-4" /></span>
                <div><p className="text-xs font-bold text-[#20243a]">AI screening summary</p><p className="text-[10px] text-[#747a91]">Candidate review · Product Designer</p></div>
              </div>
              <span className="rounded-full bg-[#eff8f1] px-2 py-1 text-[10px] font-semibold text-[#15803d]">HR review</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-md border border-[#e1e4ed] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#747a91]">Relevant signals</p>
                <div className="mt-3 space-y-2.5">
                  {["Product discovery", "Figma systems", "Cross-functional work"].map((signal) => <div key={signal} className="flex items-center gap-2 text-[11px] text-[#3c4258]"><span className="size-1.5 rounded-full bg-primary" />{signal}</div>)}
                </div>
              </div>
              <div className="rounded-md border border-[#e1e4ed] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#747a91]">Next action</p>
                <p className="mt-3 text-[11px] font-semibold leading-relaxed text-[#3c4258]">Review the CV and decide whether to move forward.</p>
                <button type="button" className="mt-4 rounded-md bg-primary px-3 py-1.5 text-[10px] font-semibold text-white">Open application</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
