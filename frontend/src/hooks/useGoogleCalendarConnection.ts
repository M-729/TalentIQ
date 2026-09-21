import { useCallback, useState } from "react";
import * as googleCalendarApi from "@/services/api/googleCalendarIntegration";
import { getConnectUrlErrorMessage, getDisconnectErrorMessage } from "@/lib/googleCalendarIntegrationErrors";

interface UseGoogleCalendarConnectionResult {
  /** Fetches the Google consent URL and performs the actual top-level browser navigation to it. Never opens it in an iframe. */
  connect: () => Promise<void>;
  disconnect: () => Promise<boolean>;
  isConnecting: boolean;
  isDisconnecting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGoogleCalendarConnection(): UseGoogleCalendarConnectionResult {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (): Promise<void> => {
    if (isConnecting) return;
    setIsConnecting(true);
    setError(null);
    try {
      const { url } = await googleCalendarApi.getGoogleCalendarConnectUrl();
      // A real top-level navigation — never fetch/XHR the OAuth consent
      // page and never render it in an iframe (Google blocks that anyway,
      // and it can't carry this app's own session).
      window.location.assign(url);
    } catch (err) {
      setError(getConnectUrlErrorMessage(err));
      setIsConnecting(false);
    }
  }, [isConnecting]);

  const disconnect = useCallback(async (): Promise<boolean> => {
    if (isDisconnecting) return false;
    setIsDisconnecting(true);
    setError(null);
    try {
      await googleCalendarApi.disconnectGoogleCalendar();
      return true;
    } catch (err) {
      setError(getDisconnectErrorMessage(err));
      return false;
    } finally {
      setIsDisconnecting(false);
    }
  }, [isDisconnecting]);

  const clearError = useCallback(() => setError(null), []);

  return { connect, disconnect, isConnecting, isDisconnecting, error, clearError };
}
