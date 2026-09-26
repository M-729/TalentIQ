import { useState, type ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HIRING_STEP_TYPES } from "@/types/hiringStep";
import type { CreateHiringStepInput, HiringStep, HiringStepType } from "@/types/hiringStep";

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 1000;

// Mirrors HiringStepTypeHelp.tsx's explanations — shown inline under the
// type select so HR understands the choice at the moment they're making
// it, not only in a separate help block. Deliberately careful wording:
// scheduling/assessment tools are described as future, not already working.
const TYPE_HINTS: Record<HiringStepType, string> = {
  review: "Internal recruiter/team review.",
  interview: "A conversation/interview stage. Scheduling tools will be available later.",
  assessment: "A testing/exercise stage. Assessment tools will be available later.",
  other: "Any custom workflow step.",
};

const TYPE_LABELS: Record<HiringStepType, string> = {
  review: "Review",
  interview: "Interview",
  assessment: "Assessment",
  other: "Other",
};

interface HiringStepFormValues {
  name: string;
  type: HiringStepType;
  description: string;
}

function toFormValues(step?: HiringStep): HiringStepFormValues {
  return {
    name: step?.name ?? "",
    type: step?.type ?? "review",
    description: step?.description ?? "",
  };
}

function validate(values: HiringStepFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmedName = values.name.trim();
  if (!trimmedName) {
    errors.name = "Stage name is required";
  } else if (trimmedName.length > NAME_MAX_LENGTH) {
    errors.name = `Stage name must be ${NAME_MAX_LENGTH} characters or fewer`;
  }
  if (values.description.trim().length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`;
  }
  return errors;
}

function buildPayload(values: HiringStepFormValues): CreateHiringStepInput {
  const payload: CreateHiringStepInput = { name: values.name.trim(), type: values.type };
  if (values.description.trim()) payload.description = values.description.trim();
  return payload;
}

function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export interface HiringStepFormProps {
  mode: "create" | "edit";
  step?: HiringStep;
  isSubmitting: boolean;
  serverError?: string | null;
  onSubmit: (payload: CreateHiringStepInput) => void | Promise<void>;
  onCancel: () => void;
}

// Position is deliberately never a field here — ordering only ever
// changes through the dedicated Move Up/Down reorder controls (see
// HiringStepCard.tsx), and the Job a stage belongs to is never
// reassignable through this form either.
export function HiringStepForm({ mode, step, isSubmitting, serverError, onSubmit, onCancel }: HiringStepFormProps) {
  const [values, setValues] = useState<HiringStepFormValues>(() => toFormValues(step));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update<K extends keyof HiringStepFormValues>(key: K, value: HiringStepFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    await onSubmit(buildPayload(values));
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
      {serverError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">{serverError}</p>
        </div>
      )}

      <Field label="Stage name" htmlFor="step-name" required error={errors.name}>
        <Input
          id="step-name"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Technical Exam"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "step-name-error" : undefined}
        />
      </Field>

      <Field label="Stage type" htmlFor="step-type" required>
        <Select
          id="step-type"
          value={values.type}
          onChange={(e) => update("type", e.target.value as HiringStepType)}
        >
          {HIRING_STEP_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">{TYPE_HINTS[values.type]}</p>
        </div>
      </Field>

      <Field label="Description (optional)" htmlFor="step-description" error={errors.description}>
        <Textarea
          id="step-description"
          rows={3}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What happens in this stage?"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "step-description-error" : undefined}
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
          {isSubmitting ? "Saving…" : mode === "create" ? "Add Stage" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
