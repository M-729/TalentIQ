import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { ApplicationDetailPage } from "@/pages/ApplicationDetailPage";
import { ApplicationScreeningPage } from "@/pages/ApplicationScreeningPage";
import { ApplicationsPage } from "@/pages/ApplicationsPage";
import { ApplyPage } from "@/pages/ApplyPage";
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
import { PublicJobPage } from "@/pages/PublicJobPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

// Deliberately minimal for now: only the routes needed to demonstrate the
// foundation (auth, protected shell, two placeholder pages). Each future
// feature ticket (Candidates, Applications, Pipeline, ...) adds its own
// route(s) here under the protected AppShell branch.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    // Public, candidate-facing — deliberately outside ProtectedRoute/AppShell:
    // candidates have no TalentIQ account and must never hit an auth wall here.
    path: "/careers/jobs/:id",
    element: <PublicJobPage />,
  },
  {
    path: "/careers/jobs/:id/apply",
    element: <ApplyPage />,
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
          { path: "/interviews", element: <InterviewsPage /> },
          { path: "/interviews/:interviewId", element: <InterviewDetailPage /> },
          { path: "/settings/integrations", element: <IntegrationsSettingsPage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
