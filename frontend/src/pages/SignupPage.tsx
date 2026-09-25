import { useState, type FormEvent } from "react";
import { Briefcase, Lock, Mail, User } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/layout/BrandMark";
import { AuthPromoPanel } from "@/components/auth/AuthPromoPanel";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api/client";
import { getCompanySignupErrorMessage } from "@/lib/companySignupErrors";

// Public self-service Company signup — creates a brand-new Company and its
// first (ADMIN) User, then signs them straight in, same as LoginPage.tsx.
// No role selector, no company selector, no candidate signup here: this is
// exclusively "start a brand-new TalentIQ workspace."
export function SignupPage() {
  const { signup, isAuthenticated, isLoading: isSessionLoading } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSessionLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signup({ fullName, email, password, companyName });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? getCompanySignupErrorMessage(err) : "Something went wrong. Please try again.");
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
                Create your TalentIQ workspace
              </h1>
              <p className="text-base text-muted-foreground">Set up your company and get started in minutes.</p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="full-name">Full name</Label>
                <IconInput
                  icon={User}
                  id="full-name"
                  name="full-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="h-14 rounded-lg bg-white text-base shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
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
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="h-14 rounded-lg bg-white text-base shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-name">Company name</Label>
                <IconInput
                  icon={Briefcase}
                  id="company-name"
                  name="company-name"
                  type="text"
                  autoComplete="organization"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  className="h-14 rounded-lg bg-white text-base shadow-none"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="h-14 w-full rounded-lg text-base shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? "Creating workspace…" : "Create workspace"}
              </Button>
            </form>

            <div className="border-t border-border pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
