import { FolderLock, KeyRound, Lock, ShieldCheck, UserRoundCheck, UserX } from "lucide-react";

const POINTS = [
  { icon: UserRoundCheck, title: "Role-based access", description: "Admin and HR roles make responsibilities clear." },
  { icon: ShieldCheck, title: "Company-scoped data", description: "Jobs, candidates, and hiring data stay separated by company." },
  { icon: FolderLock, title: "Private CV storage", description: "Candidate documents are kept within the hiring workspace." },
  { icon: KeyRound, title: "Secure response links", description: "Offer and invitation links use focused, expiring tokens." },
  { icon: Lock, title: "Protected AI credentials", description: "AI service credentials remain on the backend." },
  { icon: UserX, title: "No candidate account required", description: "Candidates can apply and respond without creating an account." },
];

export function SecuritySection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
        <div className="grid gap-10 border-b border-border pb-10 md:grid-cols-[0.85fr_1.15fr] md:items-end">
          <div><p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-primary">Designed for control</p><h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl">Hiring information stays in the right hands.</h2></div>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">Thoughtful access, company boundaries, and secure response flows are built into the way TalentIQ manages work.</p>
        </div>
        <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, description }) => (
            <article key={title} className="border-b border-border py-7 sm:pr-8 lg:[&:nth-child(3n+2)]:px-8 lg:[&:nth-child(3n)]:pl-8">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-bold text-foreground">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
