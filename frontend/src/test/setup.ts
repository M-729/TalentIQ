import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// React Testing Library normally auto-registers this via a global
// afterEach hook, but that auto-detection only fires when Vitest's
// `globals` option is enabled — which this project deliberately doesn't
// use (explicit imports are preferred over implicit test globals). Without
// this, DOM from one test would still be mounted when the next test in the
// same file runs, causing "multiple elements found" failures.
afterEach(() => {
  cleanup();
});
