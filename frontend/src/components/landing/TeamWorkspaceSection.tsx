import { Check, MessageSquareText, UserPlus, Users } from "lucide-react";

const POINTS = [
  "A dedicated workspace for every company",
  "Invite admins and HR teammates securely",
  "Keep hiring decisions and feedback in context",
];

export function TeamWorkspaceSection() {
  return (
    <section id="for-teams" className="scroll-mt-20 bg-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-12 xl:px-16">
        <div className="order-2 lg:order-1">
          <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-primary">Built for collaboration</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl">Keep the hiring team on the same page.</h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">TalentIQ gives every company its own hiring workspace, so jobs, applicant decisions, interviews, and feedback stay organized around the people making the decision.</p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => <li key={point} className="flex items-center gap-3 text-sm font-semibold text-foreground"><span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="size-3" /></span>{point}</li>)}
          </ul>
        </div>

        <div className="order-1 rounded-xl border border-border bg-[#f4f5fa] p-3 shadow-[0_18px_38px_rgba(21,23,43,0.08)] sm:p-5 lg:order-2" aria-hidden="true">
          <div className="rounded-lg border border-border bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-[#e9e6ff] text-primary"><Users className="size-4" /></span><div><p className="text-sm font-bold text-foreground">Hiring team</p><p className="text-[11px] text-muted-foreground">Northstar Studio</p></div></div>
              <span className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-white"><UserPlus className="size-3" /> Invite member</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["MA", "Maya Adams", "Admin", "bg-[#e8e5ff] text-primary"],
                ["RL", "Riley Lee", "HR", "bg-[#dff2eb] text-[#15803d]"],
                ["JT", "Jordan Taylor", "HR", "bg-[#fff0dd] text-[#a55a05]"],
              ].map(([initials, name, role, colors]) => (
                <div key={name} className="flex items-center gap-3 rounded-md border border-[#e7e9f0] px-3 py-2.5">
                  <span className={`flex size-7 items-center justify-center rounded-full text-[9px] font-bold ${colors}`}>{initials}</span>
                  <span className="flex-1 text-xs font-semibold text-foreground">{name}</span>
                  <span className="rounded-full bg-[#f1f2f6] px-2 py-1 text-[9px] font-semibold text-muted-foreground">{role}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-md bg-[#f4f5fa] px-3 py-2.5 text-[10px] text-muted-foreground"><MessageSquareText className="size-3.5 text-primary" /><span><strong className="font-semibold text-foreground">Structured feedback</strong> is ready for the next interview.</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
