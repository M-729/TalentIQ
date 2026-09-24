import { lazy } from "react";

// Split into its own file (rather than declared inline in router.tsx)
// purely so router.tsx's module only exports non-component values
// (routeConfig, router) — keeps Fast Refresh's "one component per file"
// expectation happy without changing any runtime behavior.
export const LazyHiringAnalyticsPage = lazy(() =>
  import("@/pages/HiringAnalyticsPage").then((m) => ({ default: m.HiringAnalyticsPage }))
);
