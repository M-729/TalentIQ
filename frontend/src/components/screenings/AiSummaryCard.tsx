import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AiSummaryCard({ summary }: { summary: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Analysis Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-foreground">{summary}</p>
        <p className="text-xs text-muted-foreground">AI-generated from the submitted CV and job requirements.</p>
      </CardContent>
    </Card>
  );
}
