import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { HiringPipelineNeedsAttentionApplication } from "@/types/hiringPipelineBoard";

export interface HiringPipelineNeedsAttentionProps {
  items: HiringPipelineNeedsAttentionApplication[];
}

// Deliberately renders nothing when empty — this section must never
// appear as an alarming empty warning box. Never displays
// current_step_id, Mongo ids, or any detail about the backend's internal
// consistency check; never offers a Move action here, since the backend
// may reject movement depending on exactly what's inconsistent about the
// record (see backend hiringPipelineBoard.service.ts's classification).
export function HiringPipelineNeedsAttention({ items }: HiringPipelineNeedsAttentionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Applications need attention</p>
            <p className="text-sm text-muted-foreground">
              Some applications have an inconsistent pipeline state and could not be placed in a stage.
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{item.candidate.full_name}</p>
                <p className="text-xs text-muted-foreground">{item.candidate.email}</p>
                <ApplicationStatusBadge status={item.status} />
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/applications/${resourceUrlId(item)}`}>View Application</Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
