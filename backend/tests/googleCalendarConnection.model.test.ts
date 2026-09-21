import { Types } from "mongoose";
import { GoogleCalendarConnection } from "../src/models/GoogleCalendarConnection.model";
import { encryptToken } from "../src/security/googleTokenEncryption";

function validAttrs(overrides: Record<string, unknown> = {}) {
  return {
    user_id: new Types.ObjectId(),
    company_id: new Types.ObjectId(),
    google_account_email: "alice@example.com",
    encrypted_refresh_token: { ciphertext: "abc", iv: "def", auth_tag: "ghi" },
    granted_scopes: ["https://www.googleapis.com/auth/calendar.events"],
    connected_at: new Date(),
    ...overrides,
  };
}

describe("GoogleCalendarConnection model", () => {
  it("persists a valid connection", async () => {
    const doc = await GoogleCalendarConnection.create(validAttrs());
    expect(doc._id).toBeDefined();
    expect(doc.revoked_at).toBeNull();
  });

  it("requires user_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.user_id;
    await expect(GoogleCalendarConnection.create(attrs)).rejects.toThrow();
  });

  it("requires company_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.company_id;
    await expect(GoogleCalendarConnection.create(attrs)).rejects.toThrow();
  });

  it("requires encrypted_refresh_token as a typed subdocument, not a Mixed blob", async () => {
    const namePath = GoogleCalendarConnection.schema.path("encrypted_refresh_token.ciphertext");
    expect(namePath?.instance).toBe("String");

    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.encrypted_refresh_token;
    await expect(GoogleCalendarConnection.create(attrs)).rejects.toThrow();
  });

  it("never selects encrypted_refresh_token by default", async () => {
    await GoogleCalendarConnection.create(validAttrs());
    const found = await GoogleCalendarConnection.findOne({});
    expect(found?.get("encrypted_refresh_token")).toBeUndefined();
  });

  it("persists real ciphertext produced by the encryption utility", async () => {
    const encrypted = encryptToken("fake-refresh-token-value");
    const doc = await GoogleCalendarConnection.create(validAttrs({ encrypted_refresh_token: encrypted }));

    const reread = await GoogleCalendarConnection.findById(doc.id).select("+encrypted_refresh_token");
    expect(reread?.encrypted_refresh_token.ciphertext).toBe(encrypted.ciphertext);
  });

  it("enforces one active connection per User via a partial unique index", async () => {
    const userId = new Types.ObjectId();
    await GoogleCalendarConnection.create(validAttrs({ user_id: userId }));
    await expect(GoogleCalendarConnection.create(validAttrs({ user_id: userId }))).rejects.toThrow();
  });

  it("allows a new active connection after the previous one is revoked", async () => {
    const userId = new Types.ObjectId();
    const first = await GoogleCalendarConnection.create(validAttrs({ user_id: userId }));
    await GoogleCalendarConnection.updateOne({ _id: first._id }, { $set: { revoked_at: new Date() } });

    await expect(GoogleCalendarConnection.create(validAttrs({ user_id: userId }))).resolves.toBeTruthy();
  });

  it("has a partial unique index on { user_id } scoped to revoked_at: null", () => {
    const indexes = GoogleCalendarConnection.schema.indexes();
    const uniqueIndex = indexes.find(([spec, options]) => spec.user_id === 1 && options.unique);
    expect(uniqueIndex).toBeDefined();
    const [, options] = uniqueIndex!;
    expect(options.partialFilterExpression).toEqual({ revoked_at: null });
  });
});
