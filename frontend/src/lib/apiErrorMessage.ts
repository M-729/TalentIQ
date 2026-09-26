import { ApiError } from "@/services/api/client";

// Shown when the DEVICE itself has no network connection at all — checked
// before NETWORK_UNREACHABLE_MESSAGE below, since a truly offline device
// and a stopped/unreachable-but-user-is-online backend are otherwise
// indistinguishable by error shape alone (both surface as the exact same
// `fetch()` TypeError — see isNetworkUnreachable's own doc comment). Only
// `navigator.onLine` (a real, independent browser signal) can tell them
// apart, so that's checked directly rather than inferred from the error.
export const OFFLINE_MESSAGE = "You're offline. Check your internet connection and try again.";

// A truly offline device is checked BEFORE anything about the error
// itself — including before deciding whether the error even IS a network
// failure. This matters for a real case a `err instanceof TypeError`
// check alone can't catch: device is offline, but the frontend can still
// reach a same-machine/LAN backend (e.g. localhost during development),
// and THAT backend then fails to reach something genuinely external
// (MongoDB Atlas, an API provider) and returns a normal HTTP 500. The
// fetch() to the local backend succeeds fine — no TypeError anywhere —
// so without this being checked first, that 500 would reach the ApiError
// switch below and show "Something went wrong on our side" even though
// the actual, more useful fact for the user is that THEY are offline.
// Guarded for non-browser environments (SSR, tests) where `navigator`
// may not exist at all.
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// The one user-facing sentence for "the browser could not reach the
// TalentIQ backend at all" (device IS online, so the backend itself is
// stopped/unreachable, or a DNS/CORS failure occurred) — never a
// page-specific "X could not be loaded" fallback, and never the raw
// browser/network exception text (e.g. "Failed to fetch", "NetworkError
// when attempting to fetch resource", "Load failed" on Safari, or a
// connection-refused message).
export const NETWORK_UNREACHABLE_MESSAGE = "We couldn't connect to TalentIQ. Please try again.";

// `fetch()` itself rejects with a plain TypeError when the request never
// reached a server to respond at all (offline, DNS failure, connection
// refused, CORS-blocked preflight) — this is the ONLY case client.ts's
// `request()` can produce that isn't an ApiError, since every response
// fetch() actually receives (even a 500) is turned into one. Exported so
// every domain-specific `get*ErrorMessage` helper can check this FIRST,
// before its own status-based switch/fallback — otherwise a stopped/
// unreachable backend silently falls through to that helper's contextual
// "X could not be loaded" text instead of this message, which is exactly
// the bug this export exists to fix everywhere at once.
export function isNetworkUnreachable(err: unknown): boolean {
  return err instanceof TypeError;
}

// The single source of truth for which of the two network-failure
// messages to show — call this (never the two constants above directly)
// wherever isNetworkUnreachable(err) is true, so the offline/unreachable
// precedence lives in exactly one place. `navigator.onLine` is checked
// live at call time, not cached, since connectivity can change between
// page load and this specific failed request.
export function getNetworkErrorMessage(): string {
  if (isOffline()) {
    return OFFLINE_MESSAGE;
  }
  return NETWORK_UNREACHABLE_MESSAGE;
}

// The ONE cross-cutting fallback every domain-specific `get*ErrorMessage`
// helper (interviewErrors.ts, offerErrors.ts, teamErrors.ts, ...) should
// delegate to instead of ever rendering `err.message`/`error.message`
// directly — those already never leak raw backend text for the cases
// they explicitly handle, but every remaining call site in this app used
// to fall back to the raw ApiError message for anything else (a plain
// 401/403/500/503, or a network failure). This file is that missing
// shared fallback. The backend itself already sanitizes truly dangerous
// detail (Mongo/JWT internals, stack traces — see error.middleware.ts),
// but its messages ("Invalid or expired token", "Internal server error")
// are still written for engineers, not the HR/admin/candidate users who
// actually see them — this maps them to the wording this ticket asks for.

// A 401 covers three different real situations that all deserve different
// wording, distinguished only by the backend's own (already-safe) message
// text — never anything more sensitive than that: an expired access/
// refresh token, a token that's structurally invalid/rejected, or simply
// no session at all.
export function getAuthSessionErrorMessage(err: unknown): string {
  const raw = err instanceof ApiError ? err.message.toLowerCase() : "";
  if (raw.includes("expired")) {
    return "Your session has expired. Please sign in again.";
  }
  if (raw.includes("invalid")) {
    return "Your session is no longer valid. Please sign in again.";
  }
  return "Please sign in to continue.";
}

// The shared base every list/detail/mutation error helper should fall
// back to for the statuses that mean the same thing everywhere in this
// app, rather than hand-rolling the same switch in every *Errors.ts file
// (or, worse, rendering the raw backend message). `fallback` is the
// caller's own contextual "we couldn't ___" wording for a 400/404/409/
// anything else genuinely specific to that action.
export function getGenericApiErrorMessage(err: unknown, fallback: string): string {
  // Offline is checked before anything about `err` itself — including
  // before an ApiError's own status — see isOffline's own doc comment for
  // the exact case (offline device, reachable local backend, backend's
  // own downstream 500) this ordering exists to catch.
  if (isOffline()) {
    return OFFLINE_MESSAGE;
  }
  if (isNetworkUnreachable(err)) {
    return NETWORK_UNREACHABLE_MESSAGE;
  }
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        return getAuthSessionErrorMessage(err);
      case 403:
        return "You don't have permission to perform this action.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      case 500:
        return "Something went wrong on our side. Please try again.";
      case 503:
        return "This service is temporarily unavailable. Please try again shortly.";
      default:
        return fallback;
    }
  }
  return fallback;
}
