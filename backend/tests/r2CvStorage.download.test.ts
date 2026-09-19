const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

// The S3Client constructor and its .send() are mocked; the AWS SDK's own
// error classes (e.g. NoSuchKey) are the real ones via requireActual, so
// `instanceof` checks inside r2CvStorage.service.ts behave exactly as
// they would against a real R2/S3 failure.
jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// r2CvStorage.service.ts reads R2_* from config/env at call time. Mocking
// config/env directly (rather than toggling process.env) keeps this test
// correct regardless of whether real R2 credentials exist in the local
// .env — the same lesson learned from tests/smtpEmail.service.test.ts and
// the Groq AI service tests.
function loadConfiguredStorage() {
  jest.resetModules();
  jest.doMock("../src/config/env", () => ({
    env: {
      R2_ACCOUNT_ID: "test-account-id",
      R2_ACCESS_KEY_ID: "test-access-key-id",
      R2_SECRET_ACCESS_KEY: "test-secret-access-key",
      R2_BUCKET_NAME: "test-bucket",
    },
  }));
  return (require("../src/services/storage/r2CvStorage.service") as typeof import("../src/services/storage/r2CvStorage.service"))
    .r2CvStorage;
}

describe("r2CvStorage.download", () => {
  afterEach(() => {
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();
  });

  it("returns the object's bytes as a Buffer, conforming to the provider-neutral interface", async () => {
    const expectedBytes = Buffer.from("%PDF-1.4 fake cv bytes");
    mockSend.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array(expectedBytes) },
    });

    const storage = loadConfiguredStorage();
    const result = await storage.download("talentiq/cvs/some-key");

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.equals(expectedBytes)).toBe(true);
  });

  it("sends a GetObjectCommand for the exact bucket and storage key, and never requests a signed URL", async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array(Buffer.from("bytes")) },
    });

    const storage = loadConfiguredStorage();
    await storage.download("talentiq/cvs/exact-key");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual({ Bucket: "test-bucket", Key: "talentiq/cvs/exact-key" });
    // Server-side CV parsing must never go through a signed browser URL.
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it("maps a missing object (NoSuchKey) to a safe CvStorageError with code 'not_found'", async () => {
    const actual = jest.requireActual("@aws-sdk/client-s3");
    mockSend.mockRejectedValueOnce(new actual.NoSuchKey({ message: "The specified key does not exist.", $metadata: {} }));

    const storage = loadConfiguredStorage();
    await expect(storage.download("talentiq/cvs/missing")).rejects.toMatchObject({
      name: "CvStorageError",
      code: "not_found",
    });
  });

  it("maps any other provider failure to a safe CvStorageError with code 'provider_error', without leaking internals", async () => {
    mockSend.mockRejectedValueOnce(new Error("R2 credential AKIA-fake-secret-value rejected by upstream"));

    const storage = loadConfiguredStorage();
    const rejection = storage.download("talentiq/cvs/some-key");
    await expect(rejection).rejects.toMatchObject({ name: "CvStorageError", code: "provider_error" });
    await expect(rejection).rejects.not.toThrow(/AKIA-fake-secret-value/);
  });

  it("maps a response with no Body to a safe CvStorageError", async () => {
    mockSend.mockResolvedValueOnce({});

    const storage = loadConfiguredStorage();
    await expect(storage.download("talentiq/cvs/no-body")).rejects.toMatchObject({
      name: "CvStorageError",
      code: "provider_error",
    });
  });
});
