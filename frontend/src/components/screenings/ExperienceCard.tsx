import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScreeningExperience } from "@/types/screening";

export function ExperienceCard({ experience }: { experience: ScreeningExperience }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Experience</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Phrased as "mentioned in CV", never "verified" — this is
            AI-extracted information, not a confirmed fact. Absence (null)
            is never shown as "0 years", which would misrepresent a case
            where the CV's dates were simply too ambiguous to determine. */}
        <p className="text-sm font-medium text-foreground">
          {experience.yearsMentioned !== null
            ? `Years mentioned in CV: ${experience.yearsMentioned}`
            : "Exact years not clearly determined from the CV."}
        </p>
        <p className="text-sm text-muted-foreground">{experience.summary}</p>
      </CardContent>
    </Card>
  );
}
