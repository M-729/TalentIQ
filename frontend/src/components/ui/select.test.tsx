import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select } from "@/components/ui/select";

describe("Select", () => {
  it("applies a passed className (e.g. a width utility) to the trigger wrapper, not the native select", () => {
    render(
      <Select aria-label="Test select" className="w-72">
        <option value="a">A</option>
      </Select>
    );

    const select = screen.getByRole("combobox", { name: "Test select" });
    const wrapper = select.parentElement;

    // The chevron icon is positioned `absolute` against this same wrapper
    // — if the wrapper doesn't carry the trigger's intended width, the
    // chevron visually detaches from the select's right edge (the bug this
    // test guards against).
    expect(wrapper).toHaveClass("w-72");
    expect(select).not.toHaveClass("w-72");
  });

  it("keeps the chevron icon inside the same element the width class is applied to", () => {
    render(
      <Select aria-label="Test select" className="w-72">
        <option value="a">A</option>
      </Select>
    );

    const select = screen.getByRole("combobox", { name: "Test select" });
    const wrapper = select.parentElement!;
    const chevron = wrapper.querySelector("svg");

    expect(chevron).not.toBeNull();
    expect(chevron?.parentElement).toBe(wrapper);
  });
});
