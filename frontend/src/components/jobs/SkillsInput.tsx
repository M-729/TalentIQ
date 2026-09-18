import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SkillsInputProps {
  id?: string;
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
}

export function SkillsInput({ id, value, onChange, placeholder }: SkillsInputProps) {
  const [draft, setDraft] = useState("");

  function addSkill(raw: string) {
    const skill = raw.trim();
    if (!skill) return;
    // Case-insensitive dedupe so "React" and "react" don't both get added.
    const alreadyPresent = value.some((s) => s.toLowerCase() === skill.toLowerCase());
    if (!alreadyPresent) {
      onChange([...value, skill]);
    }
    setDraft("");
  }

  function removeSkill(skill: string) {
    onChange(value.filter((s) => s !== skill));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(draft);
      return;
    }
    // Backspace on an empty draft removes the most recently added chip —
    // a common, discoverable shortcut for this kind of tag input.
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeSkill(value[value.length - 1]!);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 shadow-sm",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      )}
    >
      {value.map((skill) => (
        <span
          key={skill}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {skill}
          <button
            type="button"
            onClick={() => removeSkill(skill)}
            aria-label={`Remove ${skill}`}
            className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addSkill(draft)}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="h-6 w-auto min-w-[8ch] flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
