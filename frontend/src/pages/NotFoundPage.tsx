import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <Button asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
