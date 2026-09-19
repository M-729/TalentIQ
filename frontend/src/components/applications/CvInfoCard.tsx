import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize } from "@/lib/formatFileSize";
import type { ApplicationDetail } from "@/types/application";

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

// Safe metadata only — original_name/mime_type/size_bytes. Never the
// storage_key, an R2 URL, a signed URL, or raw CV text; none of those
// exist on ApplicationDetail in the first place. No download action here
// — no authorized download endpoint exists yet, so none is faked.
export function CvInfoCard({ cv }: { cv: ApplicationDetail["cv"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CV</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <FileText className="size-8 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">{cv.original_name}</p>
            <p className="text-xs text-muted-foreground">
              {MIME_LABELS[cv.mime_type] ?? cv.mime_type} · {formatFileSize(cv.size_bytes)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
