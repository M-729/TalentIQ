export interface ParseCvInput {
  buffer: Buffer;
  mimeType: string;
  /**
   * Kept for context only (e.g. safe logging) — never used to choose a
   * parser. The upload flow already validates a file's real bytes against
   * its claimed type (see cvFileSignature.ts); this service trusts the
   * stored, canonical mime_type, not a filename extension.
   */
  originalName: string;
}

export interface ParseCvResult {
  text: string;
  characterCount: number;
  /** True if `text` was cut to MAX_EXTRACTED_TEXT_CHARS — see cvParser.service.ts. */
  truncated: boolean;
}

export type CvParseErrorCode =
  | "unsupported_format"
  | "no_extractable_text"
  | "empty_text"
  | "malformed"
  | "parse_failed";

export class CvParseError extends Error {
  public readonly code: CvParseErrorCode;

  constructor(code: CvParseErrorCode, message: string) {
    super(message);
    this.name = "CvParseError";
    this.code = code;
  }
}
