import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Client-side check only, for immediate feedback — the backend re-validates
// by file-signature inspection regardless, since neither extension nor
// mimetype can be trusted on their own.
function isAcceptedFile(file: File): boolean {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(extension) && (ACCEPTED_MIME_TYPES.includes(file.type) || file.type === "");
}

interface CvFileInputProps {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}

export function CvFileInput({ id, file, onChange, error }: CvFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleFiles(fileList: FileList | null) {
    const selected = fileList?.[0];
    if (!selected) return;

    if (!isAcceptedFile(selected)) {
      setLocalError("Only PDF or DOCX files are accepted.");
      onChange(null);
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setLocalError("File must be 5 MB or smaller.");
      onChange(null);
      return;
    }

    setLocalError(null);
    onChange(selected);
  }

  function handleRemove() {
    onChange(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // A fresh local error (just-picked file is invalid) always wins. If a
  // valid file is currently selected, no error is shown at all — an
  // external `error` prop (e.g. a stale "required" message from an
  // earlier failed submit) must not persist once the user has already
  // corrected it by picking a valid file, since the parent only
  // recomputes its field errors on the next submit attempt, not on every
  // keystroke/selection.
  const displayError = localError ?? (file ? undefined : error);

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-describedby={displayError ? `${id}-error` : `${id}-hint`}
        aria-invalid={!!displayError}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-input bg-background px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove selected file"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            isDragging ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"
          )}
        >
          <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-foreground">
            <span className="font-medium text-primary">Choose a file</span> or drag and drop
          </p>
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            PDF or DOCX · Max 5 MB
          </p>
        </label>
      )}

      {displayError && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {displayError}
        </p>
      )}
    </div>
  );
}
