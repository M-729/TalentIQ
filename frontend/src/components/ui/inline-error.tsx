import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface InlineErrorProps {
  message: string;
  onRetry: () => void;
  /** Per-page heading, e.g. "Couldn't load jobs". Omit to reproduce the
   *  title-less, role="alert" panel layout (HiringPipelineBoard/PipelineSetupPanel). */
  title?: string;
  retryLabel?: string;
}

// Extracted from the near-identical implementations previously
// hand-duplicated across every list/detail page and the pipeline panels.
export function InlineError({ message, onRetry, title, retryLabel = "Retry" }: InlineErrorProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        {title ? (
          <div>
            <p className="font-medium text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" role="alert">
            {message}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
