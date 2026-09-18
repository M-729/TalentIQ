import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface PublicHeaderProps {
  backTo?: string;
  backLabel?: string;
}

export function PublicHeader({ backTo, backLabel }: PublicHeaderProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="inline-block size-6 rotate-45 rounded-[7px] bg-primary" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight text-foreground">TalentIQ</span>
        </div>
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel ?? "Back"}
          </Link>
        )}
      </div>
    </header>
  );
}
