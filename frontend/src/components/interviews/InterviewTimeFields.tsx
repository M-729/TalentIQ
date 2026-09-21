import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { listTimeZones } from "@/lib/timezone";

export interface InterviewTimeValues {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface InterviewTimeFieldsProps {
  values: InterviewTimeValues;
  onChange: (values: InterviewTimeValues) => void;
  disabled?: boolean;
  errors?: Partial<Record<keyof InterviewTimeValues, string>>;
  idPrefix: string;
}

const TIME_ZONES = listTimeZones();

// Shared by ScheduleInterviewDialog and RescheduleInterviewDialog — date +
// start/end time are plain native inputs (no date/time-picker library
// exists in this project), and timezone is a full IANA list (never
// hard-coded to one zone). The actual local-time -> UTC conversion
// happens in the caller via lib/timezone.ts's zonedDateTimeToUtcIso —
// this component only ever collects the raw wall-clock values.
export function InterviewTimeFields({ values, onChange, disabled, errors, idPrefix }: InterviewTimeFieldsProps) {
  function update<K extends keyof InterviewTimeValues>(key: K, value: InterviewTimeValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-date`}>
          Date<span className="text-destructive"> *</span>
        </Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={values.date}
          onChange={(e) => update("date", e.target.value)}
          disabled={disabled}
          aria-invalid={!!errors?.date}
          aria-describedby={errors?.date ? `${idPrefix}-date-error` : undefined}
        />
        {errors?.date && (
          <p id={`${idPrefix}-date-error`} role="alert" className="text-xs text-destructive">
            {errors.date}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-timezone`}>
          Timezone<span className="text-destructive"> *</span>
        </Label>
        <Select
          id={`${idPrefix}-timezone`}
          value={values.timezone}
          onChange={(e) => update("timezone", e.target.value)}
          disabled={disabled}
        >
          {TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-start`}>
          Start time<span className="text-destructive"> *</span>
        </Label>
        <Input
          id={`${idPrefix}-start`}
          type="time"
          value={values.startTime}
          onChange={(e) => update("startTime", e.target.value)}
          disabled={disabled}
          aria-invalid={!!errors?.startTime}
          aria-describedby={errors?.startTime ? `${idPrefix}-start-error` : undefined}
        />
        {errors?.startTime && (
          <p id={`${idPrefix}-start-error`} role="alert" className="text-xs text-destructive">
            {errors.startTime}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-end`}>
          End time<span className="text-destructive"> *</span>
        </Label>
        <Input
          id={`${idPrefix}-end`}
          type="time"
          value={values.endTime}
          onChange={(e) => update("endTime", e.target.value)}
          disabled={disabled}
          aria-invalid={!!errors?.endTime}
          aria-describedby={errors?.endTime ? `${idPrefix}-end-error` : undefined}
        />
        {errors?.endTime && (
          <p id={`${idPrefix}-end-error`} role="alert" className="text-xs text-destructive">
            {errors.endTime}
          </p>
        )}
      </div>
    </div>
  );
}
