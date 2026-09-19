import mammoth from "mammoth";
import { CvParseError } from "./cvParser.types";

/**
 * Extracts raw text from a DOCX buffer using mammoth — plain text only,
 * never the HTML conversion mammoth also supports, and never anything
 * that would execute or trust embedded links/macros/other content.
 *
 * mammoth throws a plain Error (not a distinguishable subclass) for every
 * failure mode — a missing main document part, a corrupt zip, etc. There
 * is no reliable, non-brittle way to split those into finer categories
 * without pattern-matching error message text, so all of them map to the
 * same "malformed" code.
 */
export async function parseDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  } catch {
    throw new CvParseError("malformed", "The DOCX file is malformed or corrupted.");
  }
}
