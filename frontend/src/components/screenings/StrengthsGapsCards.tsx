import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StrengthsGapsCards({ strengths, gaps }: { strengths: string[]; gaps: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Strengths</CardTitle>
        </CardHeader>
        <CardContent>
          {strengths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No specific strengths were identified.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
              {strengths.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Potential Gaps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gaps were identified relative to the job requirements.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
              {gaps.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          )}
          {/* "Gaps" is deliberately neutral language, never "weaknesses" or
              "problems" — see task report. */}
          <p className="text-xs text-muted-foreground">
            Gaps reflect job-relevant information not clearly evidenced in the submitted CV — not weaknesses or
            reasons to reject.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
