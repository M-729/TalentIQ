import { FileText, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ApplicationsEmptyStateProps {
  filtered: boolean;
  onClearFilters: () => void;
}

export function ApplicationsEmptyState({ filtered, onClearFilters }: ApplicationsEmptyStateProps) {
  const Icon = filtered ? SearchX : FileText;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">
            {filtered ? "No applications match your filters." : "No applications yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {filtered
              ? "Try a different search term or filter."
              : "Applications submitted to your published jobs will appear here."}
          </p>
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
