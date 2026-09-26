import { ArrowRight, BriefcaseBusiness, CalendarCheck2, ClipboardCheck, Send } from "lucide-react";

const STAGES = [
  { icon: BriefcaseBusiness, number: 1, title: "Post a job", description: "Create a job listing with all the details in minutes." },
  { icon: ClipboardCheck, number: 2, title: "Review candidates", description: "Let AI help you screen and rank applications." },
  { icon: CalendarCheck2, number: 3, title: "Conduct interviews", description: "Schedule and manage interviews with ease." },
  { icon: Send, number: 4, title: "Make the hire", description: "Choose the best candidate and move forward." },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[#f4f5fa]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
        <div className="max-w-2xl">
          <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-primary">A simple process</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl">How it works</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            From posting a job to hiring the right candidate, TalentIQ makes the process simple and efficient.
          </p>
        </div>

        <ol className="mt-14 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6">
          {STAGES.map(({ icon: Icon, number, title, description }, index) => (
            <li key={title} className="relative flex flex-col items-center text-center">
              <div className="relative">
                <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                  {number}
                </span>
              </div>
              <h3 className="mt-5 text-base font-bold text-foreground">{title}</h3>
              <p className="mt-2 max-w-[15rem] text-sm leading-relaxed text-muted-foreground">{description}</p>
              {index < STAGES.length - 1 && (
                <ArrowRight
                  className="absolute -right-3 top-7 hidden size-5 text-[#c4c9dd] lg:right-[-1.4rem] lg:block"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
