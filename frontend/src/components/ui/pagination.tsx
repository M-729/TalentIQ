import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Simple Previous/Page X of Y/Next — deliberately not infinite scroll, per
// the ATS list pattern this project wants.
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        Page {page} of {safeTotalPages}
      </span>
      <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= safeTotalPages}>
        Next
      </Button>
    </nav>
  );
}
