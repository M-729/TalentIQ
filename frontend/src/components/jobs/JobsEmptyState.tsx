import { Briefcase, Plus, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function JobsEmptyState({ filtered }: { filtered: boolean }) {
  const Icon = filtered ? SearchX : Briefcase;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">
            {filtered ? "No jobs match this filter" : "No jobs yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {filtered
              ? "Try a different status filter to see more jobs."
              : "Jobs your company creates will appear here."}
          </p>
        </div>
        {!filtered && (
          <Button asChild>
            <Link to="/jobs/new">
              <Plus className="size-4" aria-hidden="true" />
              Create Job
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
