import fs from "node:fs";
import path from "node:path";
import { parseDocxText } from "../src/services/cv/docxCvParser";

const FIXTURES = path.join(__dirname, "fixtures");

describe("parseDocxText (real mammoth, real fixtures — no mocking)", () => {
  it("extracts the expected text from a valid DOCX", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "sample.docx"));

    const text = await parseDocxText(buffer);

    expect(text).toContain("Taylor Example");
    expect(text).toContain("Backend Developer");
    expect(text).toContain("Node.js");
  });

  it("fails safely with a malformed code for a corrupted DOCX, without leaking parser internals", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "malformed.docx"));

    const rejection = parseDocxText(buffer);
    await expect(rejection).rejects.toMatchObject({ name: "CvParseError", code: "malformed" });
    await expect(rejection).rejects.toThrow("The DOCX file is malformed or corrupted.");
  });
});
