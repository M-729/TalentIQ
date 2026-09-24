import { Suspense } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { ApplicationDetailPage } from "@/pages/ApplicationDetailPage";
import { ApplicationScreeningPage } from "@/pages/ApplicationScreeningPage";
import { ApplicationsPage } from "@/pages/ApplicationsPage";
import { AssessmentsPage } from "@/pages/AssessmentsPage";
import { ApplyPage } from "@/pages/ApplyPage";
import { CareersPage } from "@/pages/CareersPage";
import { CreateJobPage } from "@/pages/CreateJobPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EditJobPage } from "@/pages/EditJobPage";
import { EmailActivityPage } from "@/pages/EmailActivityPage";
import { HiringPipelinePage } from "@/pages/HiringPipelinePage";
import { IntegrationsSettingsPage } from "@/pages/IntegrationsSettingsPage";
import { InterviewDetailPage } from "@/pages/InterviewDetailPage";
import { InterviewsPage } from "@/pages/InterviewsPage";
import { JobsPage } from "@/pages/JobsPage";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OffersPage } from "@/pages/OffersPage";
import { OfferResponsePage } from "@/pages/OfferResponsePage";
import { PublicJobPage } from "@/pages/PublicJobPage";
import { SignupPage } from "@/pages/SignupPage";
import { TeamSettingsPage } from "@/pages/TeamSettingsPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AnalyticsRouteFallback } from "@/routes/AnalyticsRouteFallback";
// Recharts (Applications Over Time / by Job / Pipeline Distribution / Offer
// Outcomes) is only ever needed on this one route — lazy-loading it keeps
// Recharts out of the initial authenticated-app bundle entirely. Every
// other authenticated page stays eagerly imported: they're small, and
// splitting them wouldn't meaningfully change the bundle (see this
// ticket's own "prioritize the safest, highest-impact optimization" rule).
import { LazyHiringAnalyticsPage as HiringAnalyticsPage } from "@/routes/LazyHiringAnalyticsPage";

// Exported separately from the created browser router (below) so tests can
// build a createMemoryRouter from the exact same route tree — e.g. to
// verify /careers stays reachable outside ProtectedRoute/AppShell while
// /jobs stays behind it — without duplicating this route table.
export const routeConfig: RouteObject[] = [
  {
    // Public TalentIQ marketing/landing page — outside ProtectedRoute/
    // AppShell, same "no auth wall" rule as every other public route
    // below. Previously redirected straight to /dashboard; an
    // authenticated user landing here now sees the marketing page like
    // any visitor would (its own CTAs still route them to /login or
    // /signup as appropriate) rather than being silently redirected.
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    // Public self-service Company signup — outside ProtectedRoute/AppShell
    // like /login, since there is no session yet.
    path: "/signup",
    element: <SignupPage />,
  },
  {
    // Public, invitee-facing — reached from the Team Invitation email's
    // Accept Invitation link. No TalentIQ account required to open it, no
    // HR sidebar, same "outside ProtectedRoute/AppShell" rule as
    // /offer-response below.
    path: "/accept-invitation",
    element: <AcceptInvitationPage />,
  },
  {
    // Public, candidate-facing — deliberately outside ProtectedRoute/AppShell:
    // candidates have no TalentIQ account and must never hit an auth wall here.
    path: "/careers",
    element: <CareersPage />,
  },
  {
    path: "/careers/jobs/:id",
    element: <PublicJobPage />,
  },
  {
    path: "/careers/jobs/:id/apply",
    element: <ApplyPage />,
  },
  {
    // Public, candidate-facing — reached from the Offer email's Accept/
    // Decline links. No TalentIQ account, no HR sidebar, same "outside
    // ProtectedRoute/AppShell" rule as /careers above.
    path: "/offer-response",
    element: <OfferResponsePage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/jobs", element: <JobsPage /> },
          { path: "/jobs/new", element: <CreateJobPage /> },
          { path: "/jobs/:id/edit", element: <EditJobPage /> },
          { path: "/applications", element: <ApplicationsPage /> },
          { path: "/applications/:applicationId", element: <ApplicationDetailPage /> },
          { path: "/applications/:applicationId/screening", element: <ApplicationScreeningPage /> },
          { path: "/hiring-pipeline", element: <HiringPipelinePage /> },
          { path: "/assessments", element: <AssessmentsPage /> },
          { path: "/offers", element: <OffersPage /> },
          { path: "/interviews", element: <InterviewsPage /> },
          { path: "/interviews/:interviewId", element: <InterviewDetailPage /> },
          { path: "/emails", element: <EmailActivityPage /> },
          {
            path: "/analytics",
            element: (
              <Suspense fallback={<AnalyticsRouteFallback />}>
                <HiringAnalyticsPage />
              </Suspense>
            ),
          },
          { path: "/settings/integrations", element: <IntegrationsSettingsPage /> },
          { path: "/settings/team", element: <TeamSettingsPage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
];

export const router = createBrowserRouter(routeConfig);
