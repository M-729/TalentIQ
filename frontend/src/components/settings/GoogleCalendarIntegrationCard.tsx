import { useState } from "react";
import { AlertCircle, AlertTriangle, CalendarDays, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { useGoogleCalendarStatus } from "@/hooks/useGoogleCalendarStatus";
import { formatDateTime } from "@/lib/formatDate";

// Never exposes any token/OAuth data — only ever renders the safe status
// fields the backend's /status endpoint returns (connected, account
// email, connected date, and the calendar_permission_granted health
// flag). See useGoogleCalendarStatus/services/api/googleCalendarIntegration.ts.
export function GoogleCalendarIntegrationCard() {
  const { status, isLoading, error, refetch } = useGoogleCalendarStatus();
  const { connect, disconnect, isConnecting, isDisconnecting, error: actionError, clearError } = useGoogleCalendarConnection();
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);

  async function handleDisconnectConfirm() {
    const succeeded = await disconnect();
    setIsDisconnectConfirmOpen(false);
    if (succeeded) refetch();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p role="alert">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refetch}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <>
            {actionError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p role="alert">{actionError}</p>
              </div>
            )}

            {!status?.connected && (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect Google Calendar to create interview events and Google Meet links.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    clearError();
                    void connect();
                  }}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting…" : "Connect Google Calendar"}
                </Button>
              </>
            )}

            {status?.connected && status.calendar_permission_granted && (
              <>
                <div className="flex items-start gap-2 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">Connected</p>
                    {status.account_email && <p className="text-muted-foreground">{status.account_email}</p>}
                    {status.connected_at && (
                      <p className="text-xs text-muted-foreground">Connected {formatDateTime(status.connected_at)}</p>
                    )}
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={() => setIsDisconnectConfirmOpen(true)} disabled={isDisconnecting}>
                  Disconnect
                </Button>
              </>
            )}

            {status?.connected && !status.calendar_permission_granted && (
              <>
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">Calendar permission needed</p>
                    <p className="text-muted-foreground">
                      {status.account_email && `${status.account_email} is connected, but `}Calendar access was not granted.
                      Reconnect and approve the Calendar permission to create interview events.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      clearError();
                      void connect();
                    }}
                    disabled={isConnecting}
                  >
                    {isConnecting ? "Connecting…" : "Reconnect Google Calendar"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsDisconnectConfirmOpen(true)} disabled={isDisconnecting}>
                    Disconnect
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={isDisconnectConfirmOpen} onOpenChange={setIsDisconnectConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Google Calendar?</DialogTitle>
            <DialogDescription>
              New interviews will no longer be able to create Calendar events or Meet links until you reconnect. Existing
              scheduled interviews and their history are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisconnectConfirmOpen(false)} disabled={isDisconnecting}>
              Keep connected
            </Button>
            <Button variant="destructive" onClick={() => void handleDisconnectConfirm()} disabled={isDisconnecting}>
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
