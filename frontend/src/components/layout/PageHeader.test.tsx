import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/layout/PageHeader";

describe("PageHeader", () => {
  it("renders the title as an h1", () => {
    render(<PageHeader title="Jobs" />);
    expect(screen.getByRole("heading", { level: 1, name: "Jobs" })).toBeInTheDocument();
  });

  it("renders the description when given", () => {
    render(<PageHeader title="Jobs" description="Manage your open positions." />);
    expect(screen.getByText("Manage your open positions.")).toBeInTheDocument();
  });

  it("omits the description entirely when not given", () => {
    const { container } = render(<PageHeader title="Jobs" />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("renders an action when given", () => {
    render(<PageHeader title="Jobs" action={<button type="button">Create Job</button>} />);
    expect(screen.getByRole("button", { name: "Create Job" })).toBeInTheDocument();
  });

  it("renders no action element when none is given", () => {
    const { container } = render(<PageHeader title="Jobs" />);
    expect(container.querySelector("button")).not.toBeInTheDocument();
  });
});
