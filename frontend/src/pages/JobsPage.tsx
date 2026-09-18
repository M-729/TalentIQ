import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Foundation placeholder only. The real Jobs list/create/edit flow (backed
// by the existing Job CRUD API) is a separate Jira task.
export function JobsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground">Manage your company's open roles.</p>
        </div>
        <Button disabled>Create Job</Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Briefcase className="size-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Job management is coming soon</p>
            <p className="text-sm text-muted-foreground">This page is a placeholder for the Jobs feature.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
