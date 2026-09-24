const STEPS = [
  "Create your workspace",
  "Publish a job",
  "Receive applications",
  "AI-assisted screening",
  "Move candidates through your pipeline",
  "Interview and assess",
  "Send an offer",
  "Hire",
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">How it works</h2>
          <p className="mt-3 text-muted-foreground">From workspace to hire, in one connected workflow.</p>
        </div>

        <ol className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step} className="rounded-lg border border-border bg-card p-4">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <p className="mt-2.5 text-sm font-medium text-foreground">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
