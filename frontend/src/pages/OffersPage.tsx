import { useEffect, useState } from "react";
import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";
import { PageHeader } from "@/components/layout/PageHeader";
import { OffersFilterBar } from "@/components/offers/OffersFilterBar";
import { OffersTable } from "@/components/offers/OffersTable";
import { useOffersList } from "@/hooks/useOffersList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useJobs } from "@/hooks/useJobs";
import type { OfferStatus } from "@/types/offer";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

function EmptyState({ filtered, onClearFilters }: { filtered: boolean; onClearFilters: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <FileSignature className="size-8 text-muted-foreground" aria-hidden="true" />
        {filtered ? (
          <>
            <p className="text-sm text-muted-foreground">No offers match your filters.</p>
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No offers yet. Create one from a candidate's Application page once you're ready to extend an offer.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Real, company-scoped offer management — never mock data. Tenant scope
// and cross-company access are enforced entirely server-side.
export function OffersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<OfferStatus | "">("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const hasActiveFilters = debouncedSearch.trim() !== "" || jobId !== "" || status !== "";

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, jobId, status]);

  const jobsQuery = useJobs();
  const { offers, pagination, isLoading, error, refetch } = useOffersList({
    search: debouncedSearch.trim() || undefined,
    jobId: jobId || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });

  function clearFilters() {
    setSearchInput("");
    setJobId("");
    setStatus("");
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Offers" description="Offers extended to candidates across your hiring pipelines." />

      <OffersFilterBar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        jobId={jobId}
        onJobIdChange={setJobId}
        status={status}
        onStatusChange={setStatus}
        jobs={jobsQuery.jobs ?? []}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <InlineError title="Couldn't load offers" message={error} onRetry={refetch} />
      ) : offers && offers.length > 0 ? (
        <>
          <OffersTable offers={offers} />
          {pagination && pagination.totalPages > 1 && <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />}
        </>
      ) : (
        <EmptyState filtered={hasActiveFilters} onClearFilters={clearFilters} />
      )}
    </div>
  );
}
