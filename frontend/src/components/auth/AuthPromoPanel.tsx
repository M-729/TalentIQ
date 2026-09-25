import { TrendingUp, Users, Zap } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";

const FEATURES = [
  { icon: Users, label: "Find great talent" },
  { icon: TrendingUp, label: "Build stronger teams" },
  { icon: Zap, label: "Grow your company" },
];

// Shared by LoginPage and SignupPage — identical decorative panel in both
// mockups (same headline/subtext/feature row/quote), desktop-only (a
// squeezed version of this composition adds nothing on a phone-width
// form, so it's simply hidden below lg rather than restacked).
type AuthPromoPanelProps = {
  /** The sign-in page has a dedicated photo-led composition; signup retains its established panel. */
  variant?: "login" | "standard";
};

export function AuthPromoPanel({ variant = "standard" }: AuthPromoPanelProps) {
  if (variant === "standard") {
    return (
      <aside className="relative hidden w-[520px] shrink-0 overflow-hidden bg-gradient-to-br from-[#F2EFFE] via-[#E9E3FC] to-[#DED2F9] lg:flex lg:flex-col lg:gap-9 lg:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-white/40" />

        <div className="relative z-10 flex h-full flex-col gap-9">
          <BrandMark to="/" />

          <div className="space-y-3">
            <h2 className="font-heading text-[34px] font-extrabold leading-tight tracking-tight text-foreground">
              Smarter Hiring
              <br />
              <span className="text-primary">Brighter Teams</span>
            </h2>
            <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
              AI-powered recruitment to help you find the right people, faster.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map((feature) => (
              <div key={feature.label} className="flex items-center gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm">
                  <feature.icon className="size-5 text-primary" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold leading-tight text-foreground">{feature.label}</span>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <p className="max-w-[30ch] font-heading text-[15px] font-semibold italic leading-snug text-accent-foreground">
            "A brighter workforce for a brighter tomorrow."
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="relative hidden min-h-svh overflow-hidden bg-[#15182f] lg:flex lg:flex-col"
      aria-label="TalentIQ benefits"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/auth-office.jpg')" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-[#11142d]/80" />

      <div className="relative z-10 flex min-h-svh flex-col px-12 py-11 xl:px-16 xl:py-14">
        <BrandMark to="/" variant="dark" className="w-fit [&_svg]:size-10 [&_span]:text-[28px]" />

        <div className="mt-[clamp(5rem,12vh,10rem)] space-y-5">
          <h2 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white xl:text-5xl">
            Smarter Hiring
            <br />
            <span className="text-[#a995ff]">Brighter Teams</span>
          </h2>
          <p className="max-w-[35ch] text-base leading-relaxed text-white/85 xl:text-lg">
            AI-powered recruitment to help you find the right people, faster.
          </p>
        </div>

        <div className="mt-10 space-y-5">
          {FEATURES.map((feature) => (
            <div key={feature.label} className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[#9e8cff]/60 bg-[#312b5a]/75 shadow-sm">
                <feature.icon className="size-5 text-[#ab9aff]" aria-hidden="true" />
              </div>
              <span className="max-w-[12ch] text-base font-semibold leading-snug text-white">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
