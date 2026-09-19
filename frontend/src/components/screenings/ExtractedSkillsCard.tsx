import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScreeningSkill } from "@/types/screening";

// Deliberately lightweight — the Required Skill Breakdown section is where
// full evidence text is shown prominently. Here, evidence (when present)
// is available as a native tooltip on hover/focus so this stays a quick
// scan, not another wall of text.
export function ExtractedSkillsCard({ skills }: { skills: ScreeningSkill[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extracted Skills</CardTitle>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills were extracted from this CV.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill.name}
                title={skill.evidence}
                className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                {skill.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
