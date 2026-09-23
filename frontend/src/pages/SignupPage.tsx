import { useState, type FormEvent } from "react";
import { Briefcase, Lock, Mail, User } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
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
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-block size-6 rotate-45 rounded-[7px] bg-primary" aria-hidden="true" />
          <span className="text-xl font-semibold tracking-tight text-foreground">TalentIQ</span>
        </div>

        <Card>
          <CardHeader className="space-y-1.5 text-center">
            <CardTitle className="text-2xl">Create your TalentIQ workspace</CardTitle>
            <CardDescription>Set up your company and get started in minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
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
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating workspace…" : "Create workspace"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary underline underline-offset-2">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
