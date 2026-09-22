import { AlertTriangle, Clock, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiDisclaimer } from "@/components/screenings/AiDisclaimer";

export type ScreeningEmptyStateVariant = "not_started" | "processing" | "stale_processing" | "failed";

interface ScreeningEmptyStateProps {
  variant: ScreeningEmptyStateVariant;
  isRunning: boolean;
  onRun: () => void;
}

const VARIANT_CONFIG: Record<
  ScreeningEmptyStateVariant,
  { icon: typeof Sparkles; title: string; body: string; buttonLabel: string; runningLabel: string }
> = {
  // Legacy Applications only — one that predates automatic screening and
  // has never been screened at all. New Applications are screened
  // automatically and never reach this variant.
  not_started: {
    icon: Sparkles,
    title: "No AI screening yet",
    body: "Run an AI-assisted CV analysis to review skills, experience, strengths, gaps, and required-skill evidence for this application.",
    // Kept as the pre-existing "Run AI Screening" label (rather than
    // "Start Screening") specifically for this legacy/never-screened
    // case, to avoid an unnecessary wording change to already-established
    // UI/tests — this ticket's Part 8 only requires SOME explicit
    // recovery action here, not a specific label.
    buttonLabel: "Run AI Screening",
    runningLabel: "Analyzing CV and job requirements…",
  },
  processing: {
    icon: Clock,
    title: "AI Screening",
    body: "Processing candidate CV… You can safely navigate away — the result will be here when it's ready.",
    buttonLabel: "",
    runningLabel: "",
  },
  // A "processing" run stuck past the configured timeout (e.g. a backend
  // crash/restart mid-screening) — HR opening this page never triggers a
  // rerun on its own; Retry stays an explicit click, exactly like "failed".
  stale_processing: {
    icon: RotateCcw,
    title: "AI Screening",
    body: "Screening was interrupted before it could finish. You can retry it now.",
    buttonLabel: "Retry Screening",
    runningLabel: "Retrying…",
  },
  failed: {
    icon: AlertTriangle,
    title: "AI Screening could not be completed",
    body: "The initial automatic screening ran into a problem. You can retry it now.",
    buttonLabel: "Retry Screening",
    runningLabel: "Retrying…",
  },
};

// Covers four distinct situations for an Application with no completed
// screening result yet: a legacy Application that predates automatic
// screening ("not_started" — Start Screening), one whose automatic
// screening is still running ("processing" — no action, no indefinite
// spinner, safe to navigate away), one whose automatic screening was
// interrupted (a stuck "processing" run past the configured timeout,
// e.g. a backend crash — "stale_processing" — Retry Screening), and one
// whose automatic screening failed outright ("failed" — Retry Screening).
// A brand-new, genuinely-in-flight Application never shows a Run-style
// button — see this ticket's explicit removal of the normal manual
// trigger; opening this page never triggers a rerun on its own, even for
// a stale/interrupted run — Retry always stays an explicit click.
export function ScreeningEmptyState({ variant, isRunning, onRun }: ScreeningEmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div className="max-w-md space-y-1">
          <p className="font-medium text-foreground">{config.title}</p>
          <p className="text-sm text-muted-foreground">{config.body}</p>
        </div>
        {variant !== "processing" && (
          <Button onClick={onRun} disabled={isRunning}>
            {isRunning ? config.runningLabel : config.buttonLabel}
          </Button>
        )}
        <AiDisclaimer />
      </CardContent>
    </Card>
  );
}
