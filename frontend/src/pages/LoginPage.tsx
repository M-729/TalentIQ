import { useState, type FormEvent } from "react";
import { Lock, Mail } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/layout/BrandMark";
import { AuthPromoPanel } from "@/components/auth/AuthPromoPanel";
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
    <div className="public-brand-theme min-h-svh bg-[#fbfbfd]">
      <div className="min-h-svh lg:grid lg:grid-cols-[minmax(0,1.28fr)_minmax(26rem,1fr)] xl:grid-cols-[minmax(0,1.32fr)_minmax(30rem,1fr)]">
        <AuthPromoPanel variant="login" />

        <main className="flex min-h-svh items-center justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="w-full max-w-md space-y-8">
            <BrandMark to="/" className="w-fit [&_svg]:size-10 [&_span]:text-[28px]" />

            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-[34px]">
                Sign in to your account
              </h1>
              <p className="text-base text-muted-foreground">HR and admin access only.</p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
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
                  placeholder="name@company.com"
                  className="h-14 rounded-lg bg-white text-base shadow-none"
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
                  placeholder="Your password"
                  className="h-14 rounded-lg bg-white text-base shadow-none"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="h-14 w-full rounded-lg text-base shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="border-t border-border pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="font-medium text-primary hover:underline">
                  Create your company
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
