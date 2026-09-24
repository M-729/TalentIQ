import { useEffect, useState } from "react";
import { AlertCircle, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { CareersEmptyState } from "@/components/careers/CareersEmptyState";
import { CareersJobCard } from "@/components/careers/CareersJobCard";
import { usePublicJobs } from "@/hooks/usePublicJobs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function CareersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const debouncedLocation = useDebouncedValue(locationInput, SEARCH_DEBOUNCE_MS);
  const hasActiveFilters = debouncedSearch.trim() !== "" || debouncedLocation.trim() !== "";

  // Any filter change should return to page 1 — otherwise a narrower
  // filter could leave the candidate stranded on a now out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedLocation]);

  const { jobs, pagination, isLoading, error, refetch } = usePublicJobs({
    search: debouncedSearch.trim() || undefined,
    location: debouncedLocation.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  });

  function clearFilters() {
    setSearchInput("");
    setLocationInput("");
    setPage(1);
  }

  return (
    <div className="min-h-svh bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Open Positions</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Explore current opportunities and apply online.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="careers-search">Search by job title</Label>
            <IconInput
              id="careers-search"
              icon={Search}
              type="search"
              placeholder="e.g. Software Engineer"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="careers-location">Location</Label>
            <IconInput
              id="careers-location"
              icon={MapPin}
              type="search"
              placeholder="e.g. Remote, Beirut"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
                <div role="alert">
                  <p className="font-medium text-foreground">Couldn't load open positions</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={refetch}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : jobs && jobs.length > 0 ? (
            <>
              {jobs.map((job) => (
                <CareersJobCard key={job._id} job={job} />
              ))}
              {pagination && pagination.totalPages > 1 && (
                <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
              )}
            </>
          ) : (
            <CareersEmptyState filtered={hasActiveFilters} onClearFilters={clearFilters} />
          )}
        </div>
      </main>
    </div>
  );
}
