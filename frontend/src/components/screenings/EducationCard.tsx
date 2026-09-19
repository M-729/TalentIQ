import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EducationCard({ education }: { education: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Education</CardTitle>
      </CardHeader>
      <CardContent>
        {education.length === 0 ? (
          // Absence is not a negative signal — phrased neutrally, not as a gap.
          <p className="text-sm text-muted-foreground">No education details were extracted.</p>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
            {education.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
