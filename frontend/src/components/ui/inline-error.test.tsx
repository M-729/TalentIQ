import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InlineError } from "@/components/ui/inline-error";

// Phase 2 accessibility baseline — both render branches must announce to
// screen readers via role="alert"; previously only the title-less branch
// did, so the 8 pages that pass a `title` announced nothing.
describe("InlineError", () => {
  it("announces the message as an alert when a title is given", () => {
    render(<InlineError title="Couldn't load jobs" message="Network error" onRetry={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load jobs");
    expect(alert).toHaveTextContent("Network error");
  });

  it("announces the message as an alert when no title is given", () => {
    render(<InlineError message="Something broke" onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
  });

  it("uses the default Retry label unless overridden", () => {
    render(<InlineError message="Oops" onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("supports a custom retry label", () => {
    render(<InlineError message="Oops" onRetry={vi.fn()} retryLabel="Try Again" />);
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });
});
