import { describe, expect, it } from "vitest";
import { resourceUrlId } from "@/lib/resourceUrlId";

describe("resourceUrlId", () => {
  it("prefers public_id when present", () => {
    expect(resourceUrlId({ id: "internal-object-id", public_id: "app_a8f13c92e51b4f638dde79bf" })).toBe(
      "app_a8f13c92e51b4f638dde79bf"
    );
  });

  it("throws rather than falling back to id when public_id is missing", () => {
    expect(() => resourceUrlId({ id: "legacy-object-id" })).toThrow(/missing public_id/);
  });
});
