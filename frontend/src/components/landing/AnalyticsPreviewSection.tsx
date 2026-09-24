// A static, illustrative preview only — generic labels, no real company
// data, no implied performance claims (see this ticket's explicit "do not
// fabricate business conclusions" rule). Deliberately plain CSS bars, not
// the real recharts-based Hiring Analytics charts: a marketing page has no
// need to ship an interactive charting library just for a preview image
// (see this ticket's own "avoid a heavy animation framework" guidance).

const APPLICATIONS_OVER_TIME = [3, 5, 4, 7, 6, 9, 8];
const APPLICATIONS_BY_JOB = [
  { label: "Job A", value: 80 },
  { label: "Job B", value: 60 },
  { label: "Job C", value: 40 },
];
const PIPELINE = [
  { label: "New", value: 90 },
  { label: "Review", value: 60 },
  { label: "Interview", value: 40 },
  { label: "Offer", value: 20 },
];
const OFFER_OUTCOMES = [
  { label: "Accepted", value: 55, tint: "bg-success" },
  { label: "Declined", value: 20, tint: "bg-destructive" },
  { label: "Pending", value: 25, tint: "bg-warning" },
];

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function AnalyticsPreviewSection() {
  const maxLine = Math.max(...APPLICATIONS_OVER_TIME);

  return (
    <section id="analytics" className="scroll-mt-16 bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Hiring analytics, from real data</h2>
          <p className="mt-3 text-muted-foreground">
            Track application volume, pipeline distribution, and offer outcomes as they actually happen — illustrative
            preview shown below.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MiniCard title="Applications Over Time">
            <div className="flex h-24 items-end gap-2" role="img" aria-label="Illustrative applications-over-time preview chart">
              {APPLICATIONS_OVER_TIME.map((value, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/70"
                  style={{ height: `${(value / maxLine) * 100}%` }}
                />
              ))}
            </div>
          </MiniCard>

          <MiniCard title="Applications by Job">
            <div className="space-y-2.5" role="img" aria-label="Illustrative applications-by-job preview chart">
              {APPLICATIONS_BY_JOB.map((row) => (
                <div key={row.label}>
                  <p className="mb-1 text-xs text-muted-foreground">{row.label}</p>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${row.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </MiniCard>

          <MiniCard title="Current Pipeline Distribution">
            <div className="flex h-24 items-end gap-2" role="img" aria-label="Illustrative pipeline-distribution preview chart">
              {PIPELINE.map((stage) => (
                <div key={stage.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-full w-full items-end">
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${stage.value}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{stage.label}</span>
                </div>
              ))}
            </div>
          </MiniCard>

          <MiniCard title="Offer Outcomes">
            <div className="space-y-2.5" role="img" aria-label="Illustrative offer-outcomes preview chart">
              {OFFER_OUTCOMES.map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  <span className={`size-2.5 shrink-0 rounded-full ${row.tint}`} aria-hidden="true" />
                  <span className="w-16 text-muted-foreground">{row.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div className={`h-full rounded-full ${row.tint}`} style={{ width: `${row.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </MiniCard>
        </div>
      </div>
    </section>
  );
}
