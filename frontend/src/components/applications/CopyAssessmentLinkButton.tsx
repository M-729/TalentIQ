import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

// Mirrors JoinMeetLink.tsx's CopyMeetLinkButton exactly (same safe
// Clipboard API pattern: button label temporarily changes on success, a
// safe accessible message with the URL still visible/selectable on
// failure) — kept as its own small component here rather than importing
// the interview-specific one, since this is a different domain (external
// assessment links, not Meet links) with its own button wording.
export function CopyAssessmentLinkButton({ url }: { url: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
        {copyState === "copied" ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copyState === "copied" ? "Link copied" : "Copy Link"}
      </Button>
      {copyState === "failed" && (
        <p role="alert" className="text-xs text-destructive">
          Could not copy the link. Please copy it manually: <span className="select-all">{url}</span>
        </p>
      )}
    </div>
  );
}
