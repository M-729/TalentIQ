import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

// Shown only for the instant it takes to fetch the /analytics route's own
// lazy-loaded chunk (see router.tsx) — deliberately mirrors
// HiringAnalyticsPage's own internal data-loading skeleton (same
// PageHeader + 6-card grid shape) so there's no layout jump between this
// fallback, the page's own loading state, and the real content. Imports
// only already-shared, Recharts-free primitives, so this file itself
// never pulls the chart library back into the initial bundle.
export function AnalyticsRouteFallback() {
  return (
    <div className="space-y-5">
      <PageHeader title="Hiring Analytics" description="Understand your recruitment activity and outcomes." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
