import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useOfferResponseLookup } from "@/hooks/useOfferResponseLookup";
import { useSubmitOfferResponse } from "@/hooks/useSubmitOfferResponse";
import type { OfferResponseIntent } from "@/types/offerResponse";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatSalary(amount?: number | null, currency?: string | null): string | null {
  if (amount == null || !currency) return null;
  return `${amount.toLocaleString()} ${currency}`;
}

/** Reads `#token=...&decision=accept|decline` from the URL fragment — never a query string or path segment (see services/api/offerResponse.ts's own doc comment on why: a fragment is never sent to any web server as part of the page load). */
function parseResponseFragment(hash: string): { token: string | null; intent: OfferResponseIntent } {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const rawIntent = params.get("decision");
  return {
    token: params.get("token"),
    intent: rawIntent === "decline" ? "decline" : "accept",
  };
}

// The public candidate response page — no TalentIQ account, no HR
// sidebar, reachable from the Offer email's Accept/Decline links. Opening
// this page (a GET/page load) performs a read-only lookup ONLY; the
// actual Offer mutation happens strictly on the candidate's own explicit
// "Confirm acceptance"/"Confirm decline" click (see this ticket's
// explicit, critical scanner-safety rule).
export function OfferResponsePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Captured ONCE, from a lazy initializer, on the very first render —
  // deliberately NOT a useMemo keyed on location.hash: clearing the hash
  // below (to keep it out of browser history) changes location.hash,
  // which would otherwise recompute this back to {token: null, ...} on
  // the very next render, discarding the token this page needs for its
  // own lookup/respond calls.
  const [{ token, intent }] = useState(() => parseResponseFragment(location.hash));

  // Drops the token out of the visible URL/browser history once read into
  // state above — there is no reason for it to keep lingering in the
  // address bar or back/forward history afterward (see this ticket's
  // explicit Part 4 "remove/replace sensitive fragment from browser
  // history when practical" rule).
  useEffect(() => {
    if (location.hash) {
      navigate(location.pathname, { replace: true });
    }
    // Intentionally only on mount — re-running this on every location
    // change would fight the very replace it just performed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { result, isLoading, error } = useOfferResponseLookup(token);
  const { run: runRespond, isSubmitting, error: respondError } = useSubmitOfferResponse();
  const [justResponded, setJustResponded] = useState<"accepted" | "declined" | null>(null);

  async function handleConfirm() {
    if (!token) return;
    const decision = intent === "accept" ? "accepted" : "declined";
    const response = await runRespond(token, decision);
    if (response?.response_state === "accepted" || response?.response_state === "declined") {
      setJustResponded(response.response_state);
    }
  }

  function renderCard(children: React.ReactNode) {
    return (
      <div className="min-h-svh bg-background">
        <PublicHeader />
        <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
          <Card>
            <CardContent className="space-y-4 py-8 text-center">{children}</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-svh bg-background">
        <PublicHeader />
        <main className="mx-auto max-w-xl space-y-4 px-4 py-8 sm:px-6 sm:py-12">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    );
  }

  if (error) {
    return renderCard(
      // A plain div (not a fragment) so `role="alert"` has somewhere to
      // live — `space-y-4` is repeated here since it now has to space
      // *this* div's own children instead of CardContent's, otherwise the
      // icon/title/message would lose their gap now that CardContent sees
      // only one direct child.
      <div role="alert" className="space-y-4">
        <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <p className="font-medium text-foreground">Something went wrong</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  // ===== Just responded on this exact page load — Part 6's result page. =====
  if (justResponded === "accepted") {
    return renderCard(
      <>
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
        <p className="text-lg font-semibold text-foreground">Offer accepted</p>
        <p className="text-sm text-muted-foreground">Thank you. Your response has been recorded. The hiring team will contact you with the next steps.</p>
      </>
    );
  }
  if (justResponded === "declined") {
    return renderCard(
      <>
        <CheckCircle2 className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-lg font-semibold text-foreground">Offer declined</p>
        <p className="text-sm text-muted-foreground">Your response has been recorded.</p>
      </>
    );
  }

  const state = result?.response_state ?? "invalid";

  // ===== Every other safe state (Part 20). =====
  if (state === "invalid") {
    return renderCard(
      <>
        <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">This link is invalid or no longer available.</p>
      </>
    );
  }
  if (state === "expired") {
    return renderCard(
      <>
        <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">This offer has expired. Please contact the hiring team if you have questions.</p>
      </>
    );
  }
  if (state === "withdrawn") {
    return renderCard(
      <>
        <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">This offer is no longer available.</p>
      </>
    );
  }
  if (state === "accepted") {
    return renderCard(
      <>
        <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden="true" />
        <p className="font-medium text-foreground">This offer has already been accepted.</p>
      </>
    );
  }
  if (state === "declined") {
    return renderCard(
      <>
        <CheckCircle2 className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">This offer has already been declined.</p>
      </>
    );
  }

  // ===== "awaiting_response" — the real confirmation form (Part 5). =====
  const salary = formatSalary(result?.salary_amount, result?.salary_currency);

  return (
    <div className="min-h-svh bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-2 py-6 text-sm text-muted-foreground">
              {result?.company_name && <p className="text-foreground">{result.company_name}</p>}
              {result?.job_title && <h1 className="text-xl font-semibold tracking-tight text-foreground">{result.job_title}</h1>}
              {result?.offer_title && <p>{result.offer_title}</p>}
              {salary && <p>Salary: {salary}</p>}
              {result?.start_date && <p>Start date: {formatDate(result.start_date)}</p>}
              {result?.expires_at && <p>Expires: {formatDate(result.expires_at)}</p>}
              {result?.candidate_message && <p className="pt-2 text-foreground">{result.candidate_message}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-6 text-center">
              {respondError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-left text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p role="alert">{respondError}</p>
                </div>
              )}

              {intent === "accept" ? (
                <>
                  <p className="text-lg font-semibold text-foreground">Accept offer?</p>
                  <p className="text-sm text-muted-foreground">
                    You&apos;re confirming that you accept the offer for {result?.job_title ?? "this position"} at {result?.company_name ?? "this company"}.
                  </p>
                  <Button onClick={() => void handleConfirm()} disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? "Confirming…" : "Confirm acceptance"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-foreground">Decline offer?</p>
                  <p className="text-sm text-muted-foreground">You&apos;re confirming that you do not wish to accept this offer.</p>
                  <Button variant="outline" onClick={() => void handleConfirm()} disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? "Confirming…" : "Confirm decline"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
