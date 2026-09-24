import { useEffect, useState } from "react";
import { AlertCircle, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmailActivityFilterBar } from "@/components/emailActivity/EmailActivityFilterBar";
import { EmailActivityTable } from "@/components/emailActivity/EmailActivityTable";
import { useEmailActivityList } from "@/hooks/useEmailActivityList";
import { useRetryEmailActivity } from "@/hooks/useRetryEmailActivity";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { EmailActivityRow, EmailActivityStatus, EmailActivityType } from "@/types/emailActivity";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

function EmptyState({ filtered, onClearFilters }: { filtered: boolean; onClearFilters: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Mail className="size-8 text-muted-foreground" aria-hidden="true" />
        {filtered ? (
          <>
            <p className="text-sm text-muted-foreground">No emails match your filters.</p>
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No email activity yet. Emails sent by TalentIQ for applications, interviews, assessments, offers, and
            invitations will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Transactional email activity/history — not an inbox, not a compose
// center. Real, company-scoped data only, paginated server-side.
export function EmailActivityPage() {
  const [searchInput, setSearchInput] = useState("");
  const [type, setType] = useState<EmailActivityType | "">("");
  const [status, setStatus] = useState<EmailActivityStatus | "">("");
  const [page, setPage] = useState(1);
  const [retryingRowId, setRetryingRowId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const hasActiveFilters = debouncedSearch.trim() !== "" || type !== "" || status !== "";

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type, status]);

  const { emails, pagination, isLoading, error, refetch } = useEmailActivityList({
    search: debouncedSearch.trim() || undefined,
    type: type || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const { run: runRetry, error: retryError } = useRetryEmailActivity();

  function clearFilters() {
    setSearchInput("");
    setType("");
    setStatus("");
    setPage(1);
  }

  async function handleRetry(row: EmailActivityRow) {
    setRetryingRowId(row.id);
    const succeeded = await runRetry(row);
    setRetryingRowId(null);
    if (succeeded) refetch();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email Activity"
        description="Transactional email history for applications, interviews, assessments, offers, and invitations."
      />

      <div className="flex flex-wrap items-center gap-3">
        <EmailActivityFilterBar
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          type={type}
          onTypeChange={setType}
          status={status}
          onStatusChange={setStatus}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {retryError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">{retryError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <InlineError title="Couldn't load email activity" message={error} onRetry={refetch} />
      ) : emails && emails.length > 0 ? (
        <>
          <EmailActivityTable rows={emails} onRetry={(row) => void handleRetry(row)} retryingRowId={retryingRowId} />
          {pagination && pagination.totalPages > 1 && (
            <Pagination page={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.total} onPageChange={setPage} />
          )}
        </>
      ) : (
        <EmptyState filtered={hasActiveFilters} onClearFilters={clearFilters} />
      )}
    </div>
  );
}
