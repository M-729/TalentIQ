// pdf-parse (built on pdfjs-dist) sets up its text-extraction worker via a
// dynamic import() internally. Under Jest's default CJS test runtime
// (without --experimental-vm-modules, which this project deliberately
// does not enable globally — the same call made for the ESM-only
// `file-type` package elsewhere in this codebase) that dynamic import
// throws: "Setting up fake worker failed: A dynamic import callback was
// invoked without --experimental-vm-modules." This is a Jest/ESM runtime
// limitation, not a bug in pdf-parse or in pdfCvParser.ts — independently
// confirmed by running the real library against these exact fixture files
// directly under plain Node (outside Jest): sample.pdf extracts the
// expected text, scannedNoText.pdf extracts empty text, and malformed.pdf
// throws pdf-parse's own InvalidPDFException. See the task report for the
// exact commands run. This mock lets these tests exercise pdfCvParser.ts's
// own real logic (getText() call shape, no-text detection, error mapping,
// destroy() cleanup) without depending on pdf-parse's real worker setup.
class FakeInvalidPDFException extends Error {}

const mockGetText = jest.fn();
const mockDestroy = jest.fn();

jest.mock("pdf-parse", () => ({
  PDFParse: jest.fn().mockImplementation(() => ({ getText: mockGetText, destroy: mockDestroy })),
  InvalidPDFException: FakeInvalidPDFException,
}));

import { parsePdfText } from "../src/services/cv/pdfCvParser";

describe("parsePdfText", () => {
  afterEach(() => {
    mockGetText.mockReset();
    mockDestroy.mockReset();
  });

  it("returns the extracted text from a successful parse", async () => {
    mockGetText.mockResolvedValueOnce({ text: "Taylor Example\nBackend Developer" });

    const text = await parsePdfText(Buffer.from("irrelevant"));

    expect(text).toBe("Taylor Example\nBackend Developer");
  });

  it("requests a plain blank-line page joiner instead of pdf-parse's default page-number marker", async () => {
    mockGetText.mockResolvedValueOnce({ text: "some text" });

    await parsePdfText(Buffer.from("irrelevant"));

    expect(mockGetText).toHaveBeenCalledWith({ pageJoiner: "\n\n" });
  });

  it("always destroys the parser instance after a successful parse", async () => {
    mockGetText.mockResolvedValueOnce({ text: "some text" });

    await parsePdfText(Buffer.from("irrelevant"));

    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it("throws a clear no_extractable_text error when getText() resolves with only whitespace", async () => {
    mockGetText.mockResolvedValueOnce({ text: "\n\n  \n" });

    await expect(parsePdfText(Buffer.from("irrelevant"))).rejects.toMatchObject({
      name: "CvParseError",
      code: "no_extractable_text",
    });
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it("maps InvalidPDFException to a safe malformed error, without leaking the raw exception", async () => {
    mockGetText.mockRejectedValueOnce(new FakeInvalidPDFException("Invalid PDF structure."));

    const rejection = parsePdfText(Buffer.from("irrelevant"));
    await expect(rejection).rejects.toMatchObject({ name: "CvParseError", code: "malformed" });
    await expect(rejection).rejects.toThrow("The PDF file is malformed or corrupted.");
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it("maps any other unexpected failure to a generic, safe parse_failed error", async () => {
    mockGetText.mockRejectedValueOnce(new Error("some internal pdfjs-dist detail that should never surface"));

    const rejection = parsePdfText(Buffer.from("irrelevant"));
    await expect(rejection).rejects.toMatchObject({ name: "CvParseError", code: "parse_failed" });
    await expect(rejection).rejects.not.toThrow(/pdfjs-dist detail/);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });
});
