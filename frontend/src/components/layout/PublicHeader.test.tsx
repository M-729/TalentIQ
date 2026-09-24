import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PublicHeader } from "@/components/layout/PublicHeader";

function renderHeader(props: React.ComponentProps<typeof PublicHeader> = {}) {
  return render(
    <MemoryRouter>
      <PublicHeader {...props} />
    </MemoryRouter>
  );
}

// 14. PublicHeader regression tests — this file did not exist before the
// BrandMark extraction; these lock down its pre-existing, unchanged
// behavior (same DOM/classes/links) now that the brand mark itself is a
// shared component.
describe("PublicHeader", () => {
  it("always links the brand mark to /careers", () => {
    renderHeader();
    const brandLink = screen.getByRole("link", { name: /TalentIQ/ });
    expect(brandLink).toHaveAttribute("href", "/careers");
  });

  it("always shows Recruiter login, linking to /login", () => {
    renderHeader();
    const link = screen.getByRole("link", { name: "Recruiter login" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("does not render a Back link when backTo is not provided", () => {
    renderHeader();
    expect(screen.queryByRole("link", { name: /Back/ })).not.toBeInTheDocument();
  });

  it("renders a Back link with the given label when backTo is provided", () => {
    renderHeader({ backTo: "/careers/jobs/job-1", backLabel: "Back to job" });
    const link = screen.getByRole("link", { name: "Back to job" });
    expect(link).toHaveAttribute("href", "/careers/jobs/job-1");
  });

  it("defaults the back link label to 'Back' when backLabel is omitted", () => {
    renderHeader({ backTo: "/careers" });
    expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument();
  });
});
