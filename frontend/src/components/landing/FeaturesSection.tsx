import { CalendarClock, ClipboardCheck, FileSignature, LineChart, ScanSearch, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "AI Candidate Screening",
    description: "Automatically surface structured CV insights and rank candidates by skills, experience, and job fit.",
  },
  {
    icon: Workflow,
    title: "Hiring Workflows",
    description: "Manage applications, interviews, and offers with a clear, simple pipeline for every role.",
  },
  {
    icon: CalendarClock,
    title: "Interview Scheduling",
    description: "Coordinate calendars, Google Meet links, and structured feedback in one connected flow.",
  },
  {
    icon: ClipboardCheck,
    title: "External Assessments",
    description: "Record assessment results while keeping the assessment tools your team already uses.",
  },
  {
    icon: FileSignature,
    title: "Offer Management",
    description: "Send offers and securely track each candidate's response, right up to the final hire.",
  },
  {
    icon: LineChart,
    title: "Detailed Analytics",
    description: "Track applications, pipeline health, and hiring outcomes to improve your process over time.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
          <div className="lg:sticky lg:top-28">
            <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-primary">For employers</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl">
              Everything you need to hire top talent
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              From posting jobs to onboarding, TalentIQ gives you all the tools to manage your hiring process in one
              place.
            </p>
            <Button asChild size="lg" className="mt-7 h-12 rounded-lg px-6 text-base shadow-sm">
              <Link to="/signup">Get started for free</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="rounded-xl border border-border bg-[#fafafb] p-5 transition-colors hover:bg-[#f4f4fb]"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-[#e9e6ff] text-primary">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
