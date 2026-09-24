import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useCompanyInvitationLookup } from "@/hooks/useCompanyInvitationLookup";
import { useAcceptCompanyInvitation } from "@/hooks/useAcceptCompanyInvitation";
import type { CompanyInvitationResponseResult } from "@/types/companyInvitation";

const ROLE_LABELS: Record<string, string> = { HR: "HR / Recruiter", ADMIN: "Admin" };

/** Reads `#token=...` from the URL fragment — never a query string or path segment, same rationale as OfferResponsePage.tsx's parseResponseFragment: a fragment is never sent to any web server as part of the page load. */
function parseTokenFragment(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw).get("token");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// The public accept-invitation page — no TalentIQ account required to
// open it, no HR sidebar, reachable from the invitation email's Accept
// Invitation link. Opening this page (a GET/page load) performs a
// read-only lookup ONLY; the actual membership mutation happens strictly
// on the invitee's own explicit "Join company" submit (see this ticket's
// explicit, critical scanner-safety rule — same design as
// OfferResponsePage.tsx).
export function AcceptInvitationPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Captured ONCE via a lazy initializer, deliberately NOT a useMemo keyed
  // on location.hash — see OfferResponsePage.tsx's own doc comment on why
  // that combination breaks once the hash is cleared below.
  const [token] = useState(() => parseTokenFragment(location.hash));

  useEffect(() => {
    if (location.hash) {
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { result, isLoading, error } = useCompanyInvitationLookup(token);
  const { run: runAccept, isSubmitting, error: acceptError } = useAcceptCompanyInvitation();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [overrideResult, setOverrideResult] = useState<CompanyInvitationResponseResult | null>(null);
  const [justJoined, setJustJoined] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (!token) return;

    const response = await runAccept(token, fullName, password);
    if (!response) return; // acceptError already set by the hook

    // Distinguishes "this exact submission just created the account"
    // (accessToken present) from "it was already accepted by someone
    // else" (state:"accepted" but no accessToken) — see
    // useAcceptCompanyInvitation.ts's own doc comment.
    if ("accessToken" in response) {
      setJustJoined(true);
    } else {
      setOverrideResult(response);
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

  // ===== Just joined on this exact page load — Part 19's result page. =====
  if (justJoined) {
    return renderCard(
      <>
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
        <p className="text-lg font-semibold text-foreground">Account created successfully</p>
        <Button onClick={() => navigate("/dashboard", { replace: true })} className="w-full sm:w-auto">
          Continue to TalentIQ
        </Button>
      </>
    );
  }

  const state = (overrideResult ?? result)?.state ?? "invalid";

  // ===== Every other safe state (Part 20). =====
  if (state === "invalid") {
    return renderCard(
      <>
        <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">This invitation link is invalid or no longer available.</p>
      </>
    );
  }
  if (state === "expired") {
    return renderCard(
      <>
        <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">This invitation has expired.</p>
      </>
    );
  }
  if (state === "revoked") {
    return renderCard(
      <>
        <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">This invitation is no longer available.</p>
      </>
    );
  }
  if (state === "accepted") {
    return renderCard(
      <>
        <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden="true" />
        <p className="font-medium text-foreground">This invitation has already been accepted.</p>
      </>
    );
  }

  // ===== "valid" — the real join form (Part 19). =====
  const roleLabel = result?.role ? (ROLE_LABELS[result.role] ?? result.role) : "team member";

  return (
    <div className="min-h-svh bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-2 py-6 text-sm text-muted-foreground">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Join {result?.company_name ?? "this company"}</h1>
              <p>
                You&apos;ve been invited as <strong className="text-foreground">{roleLabel}</strong>.
              </p>
              {result?.expires_at && <p>Expires: {formatDate(result.expires_at)}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-6">
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="invited-email">Email</Label>
                  <Input id="invited-email" type="email" value={result?.invited_email ?? ""} readOnly disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input
                    id="full-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {(formError || acceptError) && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError ?? acceptError}
                  </p>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Joining…" : "Join company"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
