import { Types } from "mongoose";
import { GoogleOAuthState } from "../src/models/GoogleOAuthState.model";

function validAttrs(overrides: Record<string, unknown> = {}) {
  return {
    state_hash: "a".repeat(64),
    user_id: new Types.ObjectId(),
    company_id: new Types.ObjectId(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
    ...overrides,
  };
}

describe("GoogleOAuthState model", () => {
  it("persists a valid state record", async () => {
    const doc = await GoogleOAuthState.create(validAttrs());
    expect(doc._id).toBeDefined();
    expect(doc.consumed_at).toBeNull();
  });

  it("requires state_hash to be unique", async () => {
    await GoogleOAuthState.create(validAttrs());
    await expect(GoogleOAuthState.create(validAttrs())).rejects.toThrow();
  });

  it("requires user_id and company_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.user_id;
    await expect(GoogleOAuthState.create(attrs)).rejects.toThrow();
  });

  it("has a TTL index on expires_at for automatic cleanup", () => {
    const indexes = GoogleOAuthState.schema.indexes();
    const ttlIndex = indexes.find(([spec, options]) => spec.expires_at === 1 && options.expireAfterSeconds === 0);
    expect(ttlIndex).toBeDefined();
  });
});
