import { CalendarDays, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface InterviewsEmptyStateProps {
  filtered: boolean;
  onClearFilters: () => void;
}

export function InterviewsEmptyState({ filtered, onClearFilters }: InterviewsEmptyStateProps) {
  const Icon = filtered ? SearchX : CalendarDays;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">
            {filtered ? "No interviews match your filters." : "No interviews scheduled yet."}
          </p>
          {filtered && <p className="text-sm text-muted-foreground">Try a different filter.</p>}
        </div>
        {filtered && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
