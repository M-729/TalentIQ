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

// jsdom implements neither ResizeObserver nor real layout (every element's
// getBoundingClientRect() is all-zero) — recharts' <ResponsiveContainer>
// needs both just to size itself at all (see
// node_modules/recharts/es6/component/ResponsiveContainer.js: it skips
// sizing entirely when `typeof ResizeObserver === "undefined"`, and reads
// containerRef.current.getBoundingClientRect() for its initial width).
// Without this, every chart silently renders nothing in tests, regardless
// of the data passed to it. No component in this codebase reads either of
// these directly (confirmed via a full source search), so this is a
// test-environment-only addition with no production behavior change.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

const CHART_TEST_WIDTH = 800;
const CHART_TEST_HEIGHT = 400;
// Approximate character metrics for recharts' own hidden
// #recharts_measurement_span (see node_modules/recharts/es6/util/DOMUtils.js's
// measureTextWithDOM) — recharts uses this element's getBoundingClientRect()
// to decide whether each axis tick label fits, then drops any tick it
// thinks doesn't. Giving every element the same large fixed size (as an
// earlier version of this mock did) made every label look 800px wide and
// get silently dropped — ticks rendered zero text in every test. A rough
// per-character width keeps that fitting logic meaningful instead.
const APPROX_CHAR_WIDTH = 7;
const APPROX_TEXT_HEIGHT = 14;

function rect(width: number, height: number): DOMRect {
  return {
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
  };
}

Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
  if (this instanceof HTMLElement && this.tagName === "SPAN" && this.id === "recharts_measurement_span") {
    return rect((this.textContent ?? "").length * APPROX_CHAR_WIDTH, APPROX_TEXT_HEIGHT);
  }
  return rect(CHART_TEST_WIDTH, CHART_TEST_HEIGHT);
};
