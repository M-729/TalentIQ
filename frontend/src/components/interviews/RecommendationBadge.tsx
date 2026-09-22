import { Badge } from "@/components/ui/badge";
import type { InterviewFeedbackRecommendation } from "@/types/interviewFeedback";

// Professional labels only — see this ticket's explicit Part 14 rule:
// recommendation badges must never rely on color alone, and must never
// turn this into green/red candidate scoring. Every recommendation uses
// the same neutral Badge variant; the text label is what communicates
// meaning, not a traffic-light color.
export const RECOMMENDATION_LABELS: Record<InterviewFeedbackRecommendation, string> = {
  strong_yes: "Strong Yes",
  yes: "Yes",
  mixed: "Mixed",
  no: "No",
  strong_no: "Strong No",
};

export function RecommendationBadge({ recommendation }: { recommendation: InterviewFeedbackRecommendation }) {
  return <Badge variant="neutral">{RECOMMENDATION_LABELS[recommendation]}</Badge>;
}
