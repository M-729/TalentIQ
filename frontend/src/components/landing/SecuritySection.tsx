import { Lock, ShieldCheck, Timer, UserX } from "lucide-react";

// Factual and modest — no certifications TalentIQ does not hold (no SOC 2,
// GDPR-compliant, ISO 27001, HIPAA, or "enterprise-grade" claims — see
// this ticket's explicit rule).
const POINTS = [
  { icon: ShieldCheck, title: "Role-based access", description: "Admin and HR roles scope what each teammate can see and do." },
  { icon: Lock, title: "Company-scoped data isolation", description: "Every company's jobs, candidates, and hiring data are kept separate." },
  { icon: Timer, title: "Secure email response links", description: "Offer and invitation links use single-purpose, expiring secure tokens." },
  { icon: UserX, title: "No candidate account required", description: "Candidates apply and respond to offers without ever creating a TalentIQ account." },
];

export function SecuritySection() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Built with security in mind</h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
