const mockParsePdfText = jest.fn();
const mockParseDocxText = jest.fn();

jest.mock("../src/services/cv/pdfCvParser", () => ({ parsePdfText: mockParsePdfText }));
jest.mock("../src/services/cv/docxCvParser", () => ({ parseDocxText: mockParseDocxText }));

import { parseCv } from "../src/services/cv/cvParser.service";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("cvParser.service (dispatch, normalization, truncation)", () => {
  afterEach(() => {
    mockParsePdfText.mockReset();
    mockParseDocxText.mockReset();
  });

  it("dispatches a PDF mime type to the PDF parser only", async () => {
    mockParsePdfText.mockResolvedValueOnce("Some CV text.");

    await parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "resume.pdf" });

    expect(mockParsePdfText).toHaveBeenCalledTimes(1);
    expect(mockParseDocxText).not.toHaveBeenCalled();
  });

  it("dispatches a DOCX mime type to the DOCX parser only", async () => {
    mockParseDocxText.mockResolvedValueOnce("Some CV text.");

    await parseCv({ buffer: Buffer.from("x"), mimeType: DOCX_MIME, originalName: "resume.docx" });

    expect(mockParseDocxText).toHaveBeenCalledTimes(1);
    expect(mockParsePdfText).not.toHaveBeenCalled();
  });

  it("rejects an unsupported mime type without guessing a parser", async () => {
    await expect(
      parseCv({ buffer: Buffer.from("x"), mimeType: "image/png", originalName: "resume.png" })
    ).rejects.toMatchObject({ name: "CvParseError", code: "unsupported_format" });

    expect(mockParsePdfText).not.toHaveBeenCalled();
    expect(mockParseDocxText).not.toHaveBeenCalled();
  });

  it("normalizes CRLF/CR line endings to LF", async () => {
    mockParsePdfText.mockResolvedValueOnce("Line one\r\nLine two\rLine three");

    const result = await parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "a.pdf" });

    expect(result.text).toBe("Line one\nLine two\nLine three");
  });

  it("removes null and control characters while preserving newlines and tabs", async () => {
    mockParsePdfText.mockResolvedValueOnce("Name\tJane\x00 Doe\x07\nSkills:\x1Bnode.js");

    const result = await parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "a.pdf" });

    expect(result.text).toBe("Name\tJane Doe\nSkills:node.js");
  });

  it("collapses excessive blank lines to a single blank line, without collapsing all structure", async () => {
    mockParsePdfText.mockResolvedValueOnce("Experience\n\n\n\n\nBackend Developer\n\nNode.js");

    const result = await parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "a.pdf" });

    expect(result.text).toBe("Experience\n\nBackend Developer\n\nNode.js");
  });

  it("trims leading and trailing whitespace", async () => {
    mockParsePdfText.mockResolvedValueOnce("\n\n  Jane Doe  \n\n");

    const result = await parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "a.pdf" });

    expect(result.text).toBe("Jane Doe");
  });

  it("throws empty_text when normalized output is empty, as a safety net beyond pdfCvParser's own check", async () => {
    mockParsePdfText.mockResolvedValueOnce("   \n\n\t  ");

    await expect(
      parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "a.pdf" })
    ).rejects.toMatchObject({ name: "CvParseError", code: "empty_text" });
  });

  it("returns truncated: false and the full character count for text under the limit", async () => {
    const text = "A normal CV worth of text.";
    mockParsePdfText.mockResolvedValueOnce(text);

    const result = await parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "a.pdf" });

    expect(result.truncated).toBe(false);
    expect(result.characterCount).toBe(text.length);
  });

  it("truncates text over the documented 50,000 character limit and reports truncated: true", async () => {
    mockParsePdfText.mockResolvedValueOnce("a".repeat(60_000));

    const result = await parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "a.pdf" });

    expect(result.truncated).toBe(true);
    expect(result.characterCount).toBe(50_000);
    expect(result.text.length).toBe(50_000);
  });

  it("propagates a CvParseError thrown by the underlying format parser unchanged", async () => {
    const { CvParseError } = jest.requireActual("../src/services/cv/cvParser.types");
    mockParsePdfText.mockRejectedValueOnce(new CvParseError("malformed", "The PDF file is malformed or corrupted."));

    await expect(
      parseCv({ buffer: Buffer.from("x"), mimeType: PDF_MIME, originalName: "a.pdf" })
    ).rejects.toMatchObject({ name: "CvParseError", code: "malformed" });
  });
});
