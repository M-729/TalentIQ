import { FileText, IdCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize } from "@/lib/formatFileSize";
import type { ApplicationDetail } from "@/types/application";

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

function Field({ label, value }: { label: string; value?: string }) {
  // Do not render blank rows for fields not provided.
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

// Context-column reference panel — merges what were three separate,
// mostly-small Cards (Candidate Information, CV, and Application
// Information's one non-duplicated field) into one panel with internal
// subsections, since Status/Applied already live in the page header now
// and don't need a third repetition here. No field was dropped — every
// value CandidateInfoCard/CvInfoCard/ApplicationInfoCard used to render
// still renders here, just grouped for scanning instead of stacked as
// separate equal-weight Cards.
export function ApplicationDetailsPanel({
  candidate,
  cv,
  source,
}: {
  candidate: ApplicationDetail["candidate"];
  cv: ApplicationDetail["cv"];
  source?: ApplicationDetail["source"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IdCard className="size-4" aria-hidden="true" />
          </span>
          Application Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Contact</p>
          <dl className="space-y-3">
            <Field label="Email" value={candidate.email} />
            <Field label="Phone" value={candidate.phone} />
            <Field label="Location" value={candidate.location} />
            <LinkField label="LinkedIn" url={candidate.linkedin_url} />
            <LinkField label="Portfolio" url={candidate.portfolio_url} />
          </dl>
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">CV</p>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{cv.original_name}</p>
              <p className="text-xs text-muted-foreground">
                {MIME_LABELS[cv.mime_type] ?? cv.mime_type} · {formatFileSize(cv.size_bytes)}
              </p>
            </div>
          </div>
        </div>

        {source && (
          <div className="border-t border-border pt-4">
            <dt className="text-xs text-muted-foreground">Source</dt>
            <dd className="text-sm text-foreground">{source}</dd>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
