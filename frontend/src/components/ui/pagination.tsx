import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Total item count, if already available from the same paginated
   *  response — never fetched separately just to show this. Rendered as
   *  its own text node (not appended into "Page X of Y") so pages already
   *  asserting that exact string keep passing unchanged. */
  totalItems?: number;
}

// Simple Previous/Page X of Y/Next — deliberately not infinite scroll, per
// the ATS list pattern this project wants.
export function Pagination({ page, totalPages, onPageChange, totalItems }: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          Page {page} of {safeTotalPages}
        </span>
        {totalItems != null && <span className="text-xs">({totalItems} {totalItems === 1 ? "result" : "results"})</span>}
      </span>
      <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= safeTotalPages}>
        Next
      </Button>
    </nav>
  );
}
