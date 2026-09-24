import { CalendarClock, ClipboardCheck, FileSignature, LineChart, ScanSearch, Workflow } from "lucide-react";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "AI-Assisted CV Screening",
    description: "Automatically screen each application once and surface structured, job-relevant insights for HR review.",
  },
  {
    icon: Workflow,
    title: "Dynamic Hiring Pipeline",
    description: "Create job-specific stages and move candidates individually or in bulk.",
  },
  {
    icon: CalendarClock,
    title: "Interview Scheduling",
    description: "Schedule interviews, connect Google Calendar, create Meet links, and collect structured interviewer feedback.",
  },
  {
    icon: ClipboardCheck,
    title: "External Assessments",
    description:
      "Send candidates to external assessment platforms and record results without locking hiring teams into one test provider.",
  },
  {
    icon: FileSignature,
    title: "Offers & Final Decisions",
    description:
      "Send offers, collect secure candidate responses, track acceptance or decline, and explicitly mark successful candidates as hired.",
  },
  {
    icon: LineChart,
    title: "Hiring Analytics",
    description: "Track real application, pipeline, offer, and hiring metrics from persisted ATS data.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-16 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Everything hiring teams need</h2>
          <p className="mt-3 text-muted-foreground">A focused toolset for the full hiring workflow, in one workspace.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
