import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateOffer } from "@/hooks/useCreateOffer";
import { useUpdateOffer } from "@/hooks/useUpdateOffer";
import { OFFER_CURRENCIES, type Offer, type OfferCurrency } from "@/types/offer";

export interface OfferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  /** Present -> editing that Draft offer. Absent -> creating a new one. */
  existingOffer: Offer | null;
  onSaved: (offer: Offer) => void;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function toIsoOrNull(dateInput: string): string | null {
  return dateInput ? new Date(`${dateInput}T00:00:00.000Z`).toISOString() : null;
}

// One form, two modes — creating (POST .../offer) vs. correcting an
// already-saved Draft (PATCH .../offers/:id). Salary amount/currency are
// always kept paired client-side, matching the backend's own pairing rule
// (see offer.validation.ts). A Draft never emails anyone on its own — Send
// Offer is always a separate, explicit action (see OfferDecisionSection.tsx).
export function OfferFormDialog({ open, onOpenChange, applicationId, existingOffer, onSaved }: OfferFormDialogProps) {
  const isEditing = !!existingOffer;
  const { run: runCreate, isSubmitting: isCreating, error: createError, clearError: clearCreateError } = useCreateOffer();
  const { run: runUpdate, isSubmitting: isUpdating, error: updateError, clearError: clearUpdateError } = useUpdateOffer();

  const [title, setTitle] = useState(existingOffer?.title ?? "");
  const [salaryAmount, setSalaryAmount] = useState(existingOffer?.salary_amount != null ? String(existingOffer.salary_amount) : "");
  const [salaryCurrency, setSalaryCurrency] = useState<OfferCurrency | "">((existingOffer?.salary_currency as OfferCurrency) ?? "");
  const [employmentType, setEmploymentType] = useState(existingOffer?.employment_type ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(existingOffer?.start_date ?? null));
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(existingOffer?.expires_at ?? null));
  const [candidateMessage, setCandidateMessage] = useState(existingOffer?.candidate_message ?? "");
  const [internalNotes, setInternalNotes] = useState(existingOffer?.internal_notes ?? "");
  const [salaryError, setSalaryError] = useState<string | null>(null);

  const isSubmitting = isCreating || isUpdating;
  const serverError = createError ?? updateError;

  function resetAndClose() {
    setTitle(existingOffer?.title ?? "");
    setSalaryAmount(existingOffer?.salary_amount != null ? String(existingOffer.salary_amount) : "");
    setSalaryCurrency((existingOffer?.salary_currency as OfferCurrency) ?? "");
    setEmploymentType(existingOffer?.employment_type ?? "");
    setStartDate(toDateInputValue(existingOffer?.start_date ?? null));
    setExpiresAt(toDateInputValue(existingOffer?.expires_at ?? null));
    setCandidateMessage(existingOffer?.candidate_message ?? "");
    setInternalNotes(existingOffer?.internal_notes ?? "");
    setSalaryError(null);
    clearCreateError();
    clearUpdateError();
    onOpenChange(false);
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    const trimmedAmount = salaryAmount.trim();

    if ((trimmedAmount !== "") !== (salaryCurrency !== "")) {
      setSalaryError("Enter both a salary amount and a currency, or leave both blank.");
      return;
    }
    let parsedAmount: number | null = null;
    if (trimmedAmount !== "") {
      const value = Number(trimmedAmount);
      if (Number.isNaN(value) || value <= 0) {
        setSalaryError("Salary must be a positive number.");
        return;
      }
      parsedAmount = value;
    }
    setSalaryError(null);

    const payload = {
      title: trimmedTitle,
      salary_amount: parsedAmount,
      salary_currency: salaryCurrency || null,
      employment_type: employmentType.trim() || null,
      start_date: toIsoOrNull(startDate),
      expires_at: toIsoOrNull(expiresAt),
      candidate_message: candidateMessage.trim() || null,
      internal_notes: internalNotes.trim() || null,
    };

    const saved = isEditing ? await runUpdate(existingOffer!.id, payload) : await runCreate(applicationId, payload);

    if (saved) {
      onSaved(saved);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? resetAndClose() : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit offer" : "Create offer"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? "Edit the details of this offer." : "Fill in the offer details to extend to this candidate."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{serverError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="offer-title">
              Offer title<span className="text-destructive"> *</span>
            </Label>
            <Input id="offer-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Backend Engineer" disabled={isSubmitting} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offer-salary-amount">Salary amount</Label>
              <Input
                id="offer-salary-amount"
                type="number"
                min={0}
                step="any"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                placeholder="95000"
                disabled={isSubmitting}
                aria-invalid={!!salaryError}
                aria-describedby={salaryError ? "offer-salary-error" : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-salary-currency">Currency</Label>
              <Select
                id="offer-salary-currency"
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value as OfferCurrency | "")}
                disabled={isSubmitting}
              >
                <option value="">Select…</option>
                {OFFER_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {salaryError && (
            <p id="offer-salary-error" role="alert" className="text-xs text-destructive">
              {salaryError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="offer-employment-type">Employment type (optional)</Label>
            <Input
              id="offer-employment-type"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              placeholder="Full-time"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offer-start-date">Start date (optional)</Label>
              <Input id="offer-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isSubmitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-expires-at">Expires on (optional)</Label>
              <Input id="offer-expires-at" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={isSubmitting} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offer-candidate-message">Candidate message (optional)</Label>
            <Textarea
              id="offer-candidate-message"
              rows={3}
              value={candidateMessage}
              onChange={(e) => setCandidateMessage(e.target.value)}
              placeholder="We're excited to have you join the team!"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offer-internal-notes">Internal notes (optional, never emailed)</Label>
            <Textarea
              id="offer-internal-notes"
              rows={3}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Candidate negotiated a signing bonus — confirm with Finance."
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Saving…" : "Save Offer"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
