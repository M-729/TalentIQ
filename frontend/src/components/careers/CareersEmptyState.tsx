import { Briefcase, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface CareersEmptyStateProps {
  filtered: boolean;
  onClearFilters: () => void;
}

export function CareersEmptyState({ filtered, onClearFilters }: CareersEmptyStateProps) {
  const Icon = filtered ? SearchX : Briefcase;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">
            {filtered ? "No positions match your search." : "No open positions are available right now."}
          </p>
          {filtered && <p className="text-sm text-muted-foreground">Try a different search term or filter.</p>}
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
