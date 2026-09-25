const APPLICATIONS_OVER_TIME = [32, 46, 39, 62, 55, 78, 69];
const APPLICATIONS_BY_JOB = [
  { label: "Product Designer", value: 82 },
  { label: "Backend Engineer", value: 62 },
  { label: "People Operations", value: 45 },
];
const PIPELINE = [
  { label: "New", value: 90 },
  { label: "Review", value: 65 },
  { label: "Interview", value: 42 },
  { label: "Offer", value: 24 },
];
const OFFER_OUTCOMES = [
  { label: "Accepted", value: 55, tint: "bg-[#15803d]" },
  { label: "Declined", value: 20, tint: "bg-[#d12222]" },
  { label: "Pending", value: 25, tint: "bg-[#a55a05]" },
];

function MiniPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-white p-4 sm:p-5"><p className="text-xs font-bold text-foreground">{title}</p><div className="mt-4">{children}</div></div>;
}

export function AnalyticsPreviewSection() {
  const maxLine = Math.max(...APPLICATIONS_OVER_TIME);

  return (
    <section id="analytics" className="scroll-mt-20 bg-[#f4f5fa]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:px-12 xl:px-16">
        <div>
          <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-primary">See the work clearly</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl">Hiring analytics from your workflow.</h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">Review application volume, roles, offer outcomes, and the current state of your pipeline without turning hiring data into guesswork.</p>
          <p className="mt-5 max-w-md border-l-2 border-primary pl-3 text-sm leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Current Pipeline Distribution</strong> is a current-state snapshot, not a conversion funnel.</p>
        </div>

        <div className="rounded-xl border border-border bg-[#e9ebf3] p-3 shadow-[0_18px_38px_rgba(21,23,43,0.08)] sm:p-4" aria-hidden="true">
          <div className="rounded-lg border border-border bg-[#fafafb] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold text-foreground">Hiring analytics</p><p className="mt-1 text-[10px] text-muted-foreground">Illustrative workspace preview</p></div><span className="rounded-md border border-border bg-white px-2 py-1 text-[10px] font-semibold text-muted-foreground">Last 30 days</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniPanel title="Applications Over Time">
                <div className="flex h-28 items-end gap-2" role="img" aria-label="Illustrative applications-over-time preview chart">
                  {APPLICATIONS_OVER_TIME.map((value, i) => <span key={i} className="flex-1 rounded-t-sm bg-primary/75" style={{ height: `${(value / maxLine) * 100}%` }} />)}
                </div>
              </MiniPanel>
              <MiniPanel title="Applications by Job">
                <div className="space-y-3" role="img" aria-label="Illustrative applications-by-job preview chart">
                  {APPLICATIONS_BY_JOB.map((row) => <div key={row.label}><p className="mb-1.5 text-[10px] text-muted-foreground">{row.label}</p><div className="h-1.5 rounded-full bg-[#eff0f5]"><div className="h-full rounded-full bg-primary" style={{ width: `${row.value}%` }} /></div></div>)}
                </div>
              </MiniPanel>
              <MiniPanel title="Current Pipeline Distribution">
                <div className="flex h-28 items-end gap-2" role="img" aria-label="Illustrative current pipeline distribution preview chart">
                  {PIPELINE.map((stage) => <div key={stage.label} className="flex flex-1 flex-col items-center gap-1.5"><div className="flex h-full w-full items-end"><span className="w-full rounded-t-sm bg-[#8175ed]" style={{ height: `${stage.value}%` }} /></div><span className="text-[9px] text-muted-foreground">{stage.label}</span></div>)}
                </div>
              </MiniPanel>
              <MiniPanel title="Offer Outcomes">
                <div className="space-y-3" role="img" aria-label="Illustrative offer outcomes preview chart">
                  {OFFER_OUTCOMES.map((row) => <div key={row.label} className="flex items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${row.tint}`} /><span className="w-14 text-[10px] text-muted-foreground">{row.label}</span><div className="h-1.5 flex-1 rounded-full bg-[#eff0f5]"><div className={`h-full rounded-full ${row.tint}`} style={{ width: `${row.value}%` }} /></div></div>)}
                </div>
              </MiniPanel>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
