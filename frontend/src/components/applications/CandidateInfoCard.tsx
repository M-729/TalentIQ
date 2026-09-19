import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationDetail } from "@/types/application";

function Field({ label, value }: { label: string; value?: string }) {
  // Do not render blank rows for fields the candidate didn't provide.
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function LinkField({ label, url }: { label: string; url?: string }) {
  if (!url) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          {url}
        </a>
      </dd>
    </div>
  );
}

export function CandidateInfoCard({ candidate }: { candidate: ApplicationDetail["candidate"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Information</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <Field label="Full name" value={candidate.full_name} />
          <Field label="Email" value={candidate.email} />
          <Field label="Phone" value={candidate.phone} />
          <Field label="Location" value={candidate.location} />
          <LinkField label="LinkedIn" url={candidate.linkedin_url} />
          <LinkField label="Portfolio" url={candidate.portfolio_url} />
        </dl>
      </CardContent>
    </Card>
  );
}
