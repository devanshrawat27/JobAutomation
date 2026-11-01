import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

import { ocrPdf } from "@/lib/resume/ocr";

export const MAX_RESUME_PAGES = 12;

export type ResumeFormat = "pdf" | "docx";

export type ExtractedResumeText = {
  text: string;
  pages: number;
  format: ResumeFormat;
  /** True when the text came from OCR rather than the PDF text layer. */
  ocr?: boolean;
};

/** Thrown for expected, user-facing failures; anything else is a real error. */
export class ResumeReadError extends Error {
  constructor(readonly reason: "unreadable" | "too-many-pages" | "empty") {
    super(reason);
  }
}

function clean(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
}

async function readPdf(bytes: Uint8Array, backup: Uint8Array): Promise<ExtractedResumeText> {
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch {
    throw new ResumeReadError("unreadable");
  }

  if (pdf.numPages > MAX_RESUME_PAGES) throw new ResumeReadError("too-many-pages");

  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const cleaned = clean(text);

  if (!cleaned) {
    // No text layer: try OCR before giving up (best effort, English only).
    // `backup` is used because the PDF parser detaches the buffer it was given.
    const ocr = await ocrPdf(backup).catch((error: unknown) => {
      console.error("OCR failed", error instanceof Error ? `${error.name}: ${error.message}` : error);
      return null;
    });
    const ocrText = ocr ? clean(ocr.text) : "";

    if (!ocrText) throw new ResumeReadError("empty");
    return { text: ocrText, pages: ocr?.pages ?? totalPages, format: "pdf", ocr: true };
  }

  return { text: cleaned, pages: totalPages, format: "pdf" };
}

async function readDocx(bytes: Uint8Array): Promise<ExtractedResumeText> {
  // A DOCX is a ZIP; both PK\x03\x04 and the empty/spanned variants are valid.
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new ResumeReadError("unreadable");

  let raw: string;
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    raw = result.value;
  } catch {
    throw new ResumeReadError("unreadable");
  }

  const cleaned = clean(raw);
  if (!cleaned) throw new ResumeReadError("empty");

  // Word has no fixed pages; treat the document as one logical unit.
  return { text: cleaned, pages: 1, format: "docx" };
}

/**
 * Read the text of a PDF or DOCX. Scanned PDFs with no text layer are reported
 * as `empty` rather than guessed at with OCR.
 */
export async function readResumeText(bytes: Uint8Array, format: ResumeFormat): Promise<ExtractedResumeText> {
  if (format === "docx") return readDocx(bytes);

  // Keep a copy: the PDF parser may detach the buffer it is handed, and OCR
  // needs the same bytes afterwards.
  const backup = new Uint8Array(bytes);
  return readPdf(bytes, backup);
}
