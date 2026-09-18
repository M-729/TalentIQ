import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { JobsPage } from "@/pages/JobsPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
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
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/jobs", element: <JobsPage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
