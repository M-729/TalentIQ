import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
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
import { HiringPipelinePage } from "@/pages/HiringPipelinePage";
import { IntegrationsSettingsPage } from "@/pages/IntegrationsSettingsPage";
import { InterviewDetailPage } from "@/pages/InterviewDetailPage";
import { InterviewsPage } from "@/pages/InterviewsPage";
import { JobsPage } from "@/pages/JobsPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OffersPage } from "@/pages/OffersPage";
import { OfferResponsePage } from "@/pages/OfferResponsePage";
import { PublicJobPage } from "@/pages/PublicJobPage";
import { SignupPage } from "@/pages/SignupPage";
import { TeamSettingsPage } from "@/pages/TeamSettingsPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

// Deliberately minimal for now: only the routes needed to demonstrate the
// foundation (auth, protected shell, two placeholder pages). Each future
// feature ticket (Candidates, Applications, Pipeline, ...) adds its own
// route(s) here under the protected AppShell branch.
//
// Exported separately from the created browser router (below) so tests can
// build a createMemoryRouter from the exact same route tree — e.g. to
// verify /careers stays reachable outside ProtectedRoute/AppShell while
// /jobs stays behind it — without duplicating this route table.
export const routeConfig: RouteObject[] = [
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
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
