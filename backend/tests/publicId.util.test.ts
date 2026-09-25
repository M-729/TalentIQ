import { generatePublicId, publicIdPattern } from "../src/utils/publicId";

describe("generatePublicId", () => {
  it("prefixes the id with the given prefix and an underscore", () => {
    expect(generatePublicId("job")).toMatch(/^job_/);
  });

  it("produces a 24-character lowercase hex suffix (12 random bytes)", () => {
    const id = generatePublicId("job");
    expect(id).toMatch(/^job_[a-f0-9]{24}$/);
  });

  it("generates a different value on every call", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generatePublicId("job")));
    expect(ids.size).toBe(200);
  });

  it("uses whatever prefix it's given, not a hardcoded one", () => {
    expect(generatePublicId("app")).toMatch(/^app_[a-f0-9]{24}$/);
  });
});

describe("publicIdPattern", () => {
  it("matches ids generatePublicId actually produces", () => {
    const pattern = publicIdPattern("job");
    for (let i = 0; i < 20; i++) {
      expect(pattern.test(generatePublicId("job"))).toBe(true);
    }
  });

  it("rejects a different prefix", () => {
    expect(publicIdPattern("job").test(generatePublicId("app"))).toBe(false);
  });

  it("rejects a raw Mongo ObjectId", () => {
    expect(publicIdPattern("job").test("507f1f77bcf86cd799439011")).toBe(false);
  });

  it("rejects an uppercase or wrong-length suffix", () => {
    const pattern = publicIdPattern("job");
    expect(pattern.test("job_A8F13C92E51B4F638DDE79BF")).toBe(false);
    expect(pattern.test("job_a8f13c92e51b4f638dde79b")).toBe(false);
  });
});
