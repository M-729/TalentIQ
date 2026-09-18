import { Candidate } from "../src/models/Candidate.model";

describe("Candidate model", () => {
  it("creates a valid candidate with only the required fields", async () => {
    const candidate = await Candidate.create({ full_name: "Jane Doe", email: "jane@example.com" });

    expect(candidate.full_name).toBe("Jane Doe");
    expect(candidate.email).toBe("jane@example.com");
    expect(candidate.created_at).toBeInstanceOf(Date);
  });

  it("requires full_name", async () => {
    await expect(Candidate.create({ email: "no-name@example.com" })).rejects.toThrow();
  });

  it("requires email", async () => {
    await expect(Candidate.create({ full_name: "No Email" })).rejects.toThrow();
  });

  it("normalizes email to lowercase and trims surrounding whitespace", async () => {
    const candidate = await Candidate.create({ full_name: "  Jane Doe  ", email: "  Jane@Example.com  " });

    expect(candidate.email).toBe("jane@example.com");
    expect(candidate.full_name).toBe("Jane Doe");
  });

  it("enforces a globally unique email", async () => {
    await Candidate.create({ full_name: "First", email: "dup@example.com" });
    await expect(Candidate.create({ full_name: "Second", email: "dup@example.com" })).rejects.toThrow();
  });

  it("does not have a company_id, password, or role field", async () => {
    const candidate = await Candidate.create({ full_name: "No Tenancy", email: "global@example.com" });
    const plain = candidate.toObject();

    expect(plain).not.toHaveProperty("company_id");
    expect(plain).not.toHaveProperty("password_hash");
    expect(plain).not.toHaveProperty("role");
  });

  it("no longer has a cv_file_url field (moved to Application.cv_file)", async () => {
    const candidate = await Candidate.create({ full_name: "No CV Here", email: "no-cv@example.com" });
    const plain = candidate.toObject();

    expect(plain).not.toHaveProperty("cv_file_url");
  });
});
