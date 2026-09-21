import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { GoogleCalendarIntegrationCard } from "@/components/settings/GoogleCalendarIntegrationCard";

// Handles the backend OAuth callback's redirect
// (/settings/integrations?googleCalendar=connected|error) — this route
// previously didn't exist at all, which is exactly what caused that
// redirect to land on a frontend 404 before this ticket.
export function IntegrationsSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [banner, setBanner] = useState<"connected" | "error" | null>(null);
  // GoogleCalendarIntegrationCard fetches its own status independently on
  // mount, so a fresh mount after connecting already shows the latest
  // state — this key just forces that fresh mount/refetch once, right
  // after a successful callback.
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const handledParam = useRef(false);

  useEffect(() => {
    if (handledParam.current) return;
    const result = searchParams.get("googleCalendar");
    if (result !== "connected" && result !== "error") return;

    handledParam.current = true;
    setBanner(result);
    if (result === "connected") {
      setStatusRefreshKey((k) => k + 1);
    }

    // Clean up the query param after handling it, so a page refresh
    // doesn't re-show the banner or re-trigger this effect.
    const next = new URLSearchParams(searchParams);
    next.delete("googleCalendar");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect external tools to your hiring workflow.</p>
      </div>

      {banner === "connected" && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="status">Google Calendar connected successfully.</p>
        </div>
      )}
      {banner === "error" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">Google Calendar could not be connected. Please try again.</p>
        </div>
      )}

      <GoogleCalendarIntegrationCard key={statusRefreshKey} />
    </div>
  );
}
