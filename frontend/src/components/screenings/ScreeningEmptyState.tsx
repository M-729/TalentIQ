import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiDisclaimer } from "@/components/screenings/AiDisclaimer";

export function ScreeningEmptyState({ isRunning, onRun }: { isRunning: boolean; onRun: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <Sparkles className="size-8 text-muted-foreground" aria-hidden="true" />
        <div className="max-w-md space-y-1">
          <p className="font-medium text-foreground">No AI screening yet</p>
          <p className="text-sm text-muted-foreground">
            Run an AI-assisted CV analysis to review skills, experience, strengths, gaps, and required-skill evidence
            for this application.
          </p>
        </div>
        <Button onClick={onRun} disabled={isRunning}>
          {isRunning ? "Analyzing CV and job requirements…" : "Run AI Screening"}
        </Button>
        <AiDisclaimer />
      </CardContent>
    </Card>
  );
}
