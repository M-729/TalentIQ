import { parseDocxText } from "./docxCvParser";
import { CvParseError } from "./cvParser.types";
import { parsePdfText } from "./pdfCvParser";
import type { ParseCvInput, ParseCvResult } from "./cvParser.types";

const PDF_MIME_TYPE = "application/pdf";
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// A real CV is rarely more than a few pages (a few thousand characters).
// 50,000 characters is generous headroom above that (roughly 25-40 pages
// of dense text) while still bounding worst-case pathological input (e.g.
// a corrupted PDF that decodes to a huge repeated stream) before this text
// is ever handed to an LLM in the next ticket.
const MAX_EXTRACTED_TEXT_CHARS = 50_000;

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  let cut = maxChars;
  // Avoid splitting a UTF-16 surrogate pair in half at the cut boundary.
  if (cut > 0 && isHighSurrogate(text.charCodeAt(cut - 1)) && isLowSurrogate(text.charCodeAt(cut))) {
    cut -= 1;
  }

  return { text: text.slice(0, cut), truncated: true };
}

/**
 * Normalizes raw parser output before any future AI use: consistent line
 * endings, no null/control characters, no excessive blank runs, no
 * leading/trailing whitespace. Deliberately does NOT collapse everything
 * to one line — paragraph/section structure (e.g. "Experience" on its own
 * line) is meaningful signal for the CV analysis this feeds later.
 */
function normalizeExtractedText(raw: string): string {
  const unixNewlines = raw.replace(/\r\n?/g, "\n");
  // eslint-disable-next-line no-control-regex -- deliberately stripping C0/C1 control chars, keeping \n and \t
  const withoutControlChars = unixNewlines.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g, "");
  const collapsedBlankLines = withoutControlChars.replace(/\n{3,}/g, "\n\n");
  return collapsedBlankLines.trim();
}

/**
 * The single entry point the rest of the app depends on for turning a CV
 * file's bytes into plain text — never PDF/DOCX library APIs directly.
 * Dispatches by the file's canonical mime_type (never a filename
 * extension) to the matching format-specific parser, then applies one
 * shared normalization + size-limit pass regardless of source format.
 */
export async function parseCv(input: ParseCvInput): Promise<ParseCvResult> {
  let rawText: string;

  if (input.mimeType === PDF_MIME_TYPE) {
    rawText = await parsePdfText(input.buffer);
  } else if (input.mimeType === DOCX_MIME_TYPE) {
    rawText = await parseDocxText(input.buffer);
  } else {
    throw new CvParseError("unsupported_format", `Unsupported CV MIME type: ${input.mimeType}`);
  }

  const normalized = normalizeExtractedText(rawText);
  if (normalized.length === 0) {
    // A safety net beyond pdfCvParser's own "no_extractable_text" check —
    // covers a DOCX with an empty body, or any parser output that
    // normalizes down to nothing.
    throw new CvParseError("empty_text", "Extracted CV text is empty.");
  }

  const { text, truncated } = truncate(normalized, MAX_EXTRACTED_TEXT_CHARS);
  return { text, characterCount: text.length, truncated };
}

export { CvParseError } from "./cvParser.types";
export type { CvParseErrorCode, ParseCvInput, ParseCvResult } from "./cvParser.types";
