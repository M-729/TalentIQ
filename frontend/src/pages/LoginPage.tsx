import { useState, type FormEvent } from "react";
import { Lock, Mail } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/layout/BrandMark";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api/client";

export function LoginPage() {
  const { login, isAuthenticated, isLoading: isSessionLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  if (!isSessionLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <h1 className="sr-only">Sign in to TalentIQ</h1>
        <div className="flex items-center justify-center">
          <BrandMark to="/" />
        </div>

        <Card>
          <CardHeader className="space-y-1.5 text-center">
            <CardTitle className="text-2xl">Sign in to your account</CardTitle>
            <CardDescription>HR and Admin access only.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <IconInput
                  icon={Mail}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <IconInput
                  icon={Lock}
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Looking for a job?{" "}
          <Link to="/careers" className="font-medium text-primary underline underline-offset-2">
            Browse open positions
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          New to TalentIQ?{" "}
          <Link to="/signup" className="font-medium text-primary underline underline-offset-2">
            Create company
          </Link>
        </p>
      </div>
    </main>
  );
}
