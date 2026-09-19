import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import type { ApplicationDetail } from "@/types/application";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Read-only for this ticket — no status editing here.
export function ApplicationInfoCard({ application }: { application: ApplicationDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Information</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-0.5">
              <ApplicationStatusBadge status={application.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Applied</dt>
            <dd className="text-sm text-foreground">{formatDate(application.applied_at)}</dd>
          </div>
          {application.source && (
            <div>
              <dt className="text-xs text-muted-foreground">Source</dt>
              <dd className="text-sm text-foreground">{application.source}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
