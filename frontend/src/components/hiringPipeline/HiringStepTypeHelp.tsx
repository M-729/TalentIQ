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
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Stage type will determine the actions available for candidates in this stage. The stage name is entirely
            up to you — type just tells TalentIQ what kind of step it is.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-3 pl-6 sm:grid-cols-2">
          {HIRING_STEP_TYPES.map((type) => (
            <div key={type} className="flex items-start gap-2">
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
