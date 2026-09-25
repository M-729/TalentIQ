import { describe, expect, it } from "vitest";
import { jobUrlId } from "@/lib/jobUrlId";

describe("jobUrlId", () => {
  it("prefers public_id when present", () => {
    expect(jobUrlId({ _id: "internal-object-id", public_id: "job_a8f13c92e51b4f638dde79bf" })).toBe(
      "job_a8f13c92e51b4f638dde79bf"
    );
  });

  it("throws rather than falling back to _id when public_id is missing", () => {
    expect(() => jobUrlId({ _id: "legacy-object-id" })).toThrow(/missing public_id/);
  });
});
