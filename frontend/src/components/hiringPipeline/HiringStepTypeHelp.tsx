import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HIRING_STEP_TYPES } from "@/types/hiringStep";
import { HiringStepTypeBadge } from "@/components/hiringPipeline/HiringStepTypeBadge";

// Deliberately careful wording throughout: stage type is workflow
// *metadata* today. Nothing here may imply interview scheduling, Google
// Meet, or assessment sending already work — those are future tickets.
const TYPE_EXPLANATIONS: Record<(typeof HIRING_STEP_TYPES)[number], string> = {
  review: "Internal recruiter/team review.",
  interview: "A conversation/interview stage. Scheduling tools will be available later.",
  assessment: "A testing/exercise stage. Assessment tools will be available later.",
  other: "Any custom workflow step.",
};

export function HiringStepTypeHelp() {
  return (
    <Card className="border-border bg-muted/20">
      <CardContent className="space-y-4 py-4">
        <div className="flex items-start gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Info className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm text-foreground">
            Stage type will determine the actions available for candidates in this stage. The stage name is entirely
            up to you — type just tells TalentIQ what kind of step it is.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {HIRING_STEP_TYPES.map((type) => (
            <div key={type} className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <dt>
                <HiringStepTypeBadge type={type} />
              </dt>
              <dd className="text-xs text-muted-foreground">{TYPE_EXPLANATIONS[type]}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
