import { KeyRound, ShieldCheck, UserCog, Users } from "lucide-react";

const POINTS = [
  { icon: Users, title: "Company workspace", description: "Sign up and get your own company workspace in minutes." },
  { icon: UserCog, title: "Invite your team", description: "Admins invite HR teammates by email with secure, expiring invitations." },
  { icon: KeyRound, title: "Role-based access", description: "Admin and HR roles keep responsibilities and permissions clear." },
  {
    icon: ShieldCheck,
    title: "Secure multi-tenant separation",
    description: "Every company's data is isolated — accounts, jobs, applications, and more.",
  },
];

export function TeamWorkspaceSection() {
  return (
    <section id="for-teams" className="scroll-mt-16 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Built for hiring teams</h2>
          <p className="mt-3 text-muted-foreground">
            One workspace per company, with the access controls a growing team needs — including deactivating an
            account when someone leaves.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
