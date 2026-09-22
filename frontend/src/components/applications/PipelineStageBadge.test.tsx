import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStageBadge } from "@/components/applications/PipelineStageBadge";
import type { ApplicationListRow } from "@/types/application";

function renderBadge(application: Pick<ApplicationListRow, "status" | "current_step">) {
  render(<PipelineStageBadge application={application} />);
}

describe("PipelineStageBadge", () => {
  // Color is driven by current_step.TYPE, never by the dynamic stage name
  // — two differently-named stages of the same type must render identical
  // colors, and the label must always be the actual stage name.
  it("styles a review-type stage blue and shows its actual name", () => {
    renderBadge({ status: "in_process", current_step: { id: "s1", name: "HR Review", type: "review" } });
    const badge = screen.getByText("HR Review");
    expect(badge.className).toMatch(/text-blue-700/);
    expect(badge.className).toMatch(/bg-blue-500\/10/);
  });

  it("styles an interview-type stage purple and shows its actual name", () => {
    renderBadge({ status: "in_process", current_step: { id: "s2", name: "Technical Interview", type: "interview" } });
    const badge = screen.getByText("Technical Interview");
    expect(badge.className).toMatch(/text-purple-700/);
    expect(badge.className).toMatch(/bg-purple-500\/10/);
  });

  it("styles an assessment-type stage amber/warning and shows its actual name", () => {
    renderBadge({ status: "in_process", current_step: { id: "s3", name: "External Assessment", type: "assessment" } });
    const badge = screen.getByText("External Assessment");
    expect(badge.className).toMatch(/text-warning/);
    expect(badge.className).toMatch(/bg-warning\/10/);
  });

  it("styles an other-type stage neutral gray and shows its actual name", () => {
    renderBadge({ status: "in_process", current_step: { id: "s4", name: "Reference Check", type: "other" } });
    const badge = screen.getByText("Reference Check");
    expect(badge.className).toMatch(/text-muted-foreground/);
    expect(badge.className).toMatch(/bg-muted/);
  });

  it("never colors by stage name — two differently-named interview stages render the same color", () => {
    const { unmount } = render(
      <PipelineStageBadge application={{ status: "in_process", current_step: { id: "s5", name: "First Interview", type: "interview" } }} />
    );
    const first = screen.getByText("First Interview").className;
    unmount();

    render(<PipelineStageBadge application={{ status: "in_process", current_step: { id: "s6", name: "Culture Chat", type: "interview" } }} />);
    const second = screen.getByText("Culture Chat").className;

    expect(first).toBe(second);
  });

  it('shows "New Applicant" with a neutral gray badge when applied and current_step is null', () => {
    renderBadge({ status: "applied", current_step: null });
    const badge = screen.getByText("New Applicant");
    expect(badge.className).toMatch(/text-muted-foreground/);
    expect(badge.className).toMatch(/bg-muted/);
  });

  it("falls back to a neutral gray In Process badge for inconsistent legacy data (in_process, no current_step)", () => {
    renderBadge({ status: "in_process", current_step: null });
    const badge = screen.getByText("In Process");
    expect(badge.className).toMatch(/text-muted-foreground/);
  });

  it("shows a red badge for a rejected application, even if current_step is still set", () => {
    renderBadge({ status: "rejected", current_step: { id: "s7", name: "Final Interview", type: "interview" } });
    const badge = screen.getByText("Rejected");
    expect(badge.className).toMatch(/text-destructive/);
    expect(screen.queryByText("Final Interview")).not.toBeInTheDocument();
  });

  it("shows a green/teal badge for an offered application", () => {
    renderBadge({ status: "offered", current_step: null });
    const badge = screen.getByText("Offered");
    expect(badge.className).toMatch(/text-teal-700/);
  });

  it("shows a strong green badge for a hired application, distinct from offered", () => {
    renderBadge({ status: "hired", current_step: null });
    const badge = screen.getByText("Hired");
    expect(badge.className).toMatch(/text-success/);
    expect(badge.className).toMatch(/bg-success\/15/);
  });

  it("renders offered and hired with visually different classes", () => {
    const { unmount } = render(<PipelineStageBadge application={{ status: "offered", current_step: null }} />);
    const offeredClass = screen.getByText("Offered").className;
    unmount();

    render(<PipelineStageBadge application={{ status: "hired", current_step: null }} />);
    const hiredClass = screen.getByText("Hired").className;

    expect(offeredClass).not.toBe(hiredClass);
  });

  it("falls back to neutral gray for an unrecognized/unexpected stage type rather than crashing", () => {
    renderBadge({ status: "in_process", current_step: { id: "s8", name: "Mystery Stage", type: "not_a_real_type" } });
    const badge = screen.getByText("Mystery Stage");
    expect(badge.className).toMatch(/text-muted-foreground/);
  });
});
