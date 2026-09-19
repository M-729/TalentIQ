import { InvalidPDFException, PDFParse } from "pdf-parse";
import { CvParseError } from "./cvParser.types";

/**
 * Extracts raw text from a PDF buffer using pdf-parse (built on Mozilla's
 * pdfjs-dist) — text extraction only, no script execution, no rendering.
 * `pageJoiner` is set to a plain blank line instead of the library's
 * default "-- page N of M --" marker, since that marker would otherwise
 * end up inside AI-facing CV text.
 */
export async function parsePdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ pageJoiner: "\n\n" });
    const text = result.text ?? "";

    if (text.trim().length === 0) {
      // The most common real-world cause is a scanned/image-only PDF.
      // Adding OCR to handle that case is a deliberately deferred future
      // enhancement, not part of this ticket.
      throw new CvParseError(
        "no_extractable_text",
        "The PDF has no extractable text (it may be a scanned/image-only document)."
      );
    }

    return text;
  } catch (err) {
    if (err instanceof CvParseError) throw err;
    if (err instanceof InvalidPDFException) {
      throw new CvParseError("malformed", "The PDF file is malformed or corrupted.");
    }
    throw new CvParseError("parse_failed", "Failed to parse the PDF file.");
  } finally {
    await parser.destroy();
  }
}
