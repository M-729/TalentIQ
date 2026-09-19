import { Badge } from "@/components/ui/badge";

// "Not screened" is a neutral gray badge, never red — it is not an error
// or a negative signal, just an action HR hasn't taken yet.
export function ScreeningStatusBadge({ hasScreening }: { hasScreening: boolean }) {
  if (!hasScreening) {
    return <Badge variant="neutral">Not screened</Badge>;
  }
  return <Badge variant="success">Screened</Badge>;
}
