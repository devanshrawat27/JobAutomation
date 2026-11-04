"use server";

import { aiExtractionEnabled } from "@/lib/ai/gemini";
import { extractWithAi } from "@/lib/resume/extract-with-ai";
import { proposeFactsFromResume, type ResumeProposal } from "@/lib/resume/propose-facts";
import { readResumeText, ResumeReadError, type ResumeFormat } from "@/lib/resume/read-text";
import { sanitizeProposal } from "@/lib/resume/sanitize";

const MAX_BYTES = 5 * 1024 * 1024;

export type ExtractResult =
  | { ok: true; extraction: ResumeProposal }
  | {
      ok: false;
      reason:
        | "missing-file"
        | "too-large"
        | "unsupported-type"
        | "unreadable"
        | "too-many-pages"
        | "empty"
        | "no-facts";
    };

function formatFor(file: File): ResumeFormat | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  return null;
}

/** "LinkedIn" on its own is a link label, not the URL behind it. */

/**
 * Read the uploaded resume on this server and propose facts.
 *
 * Nothing is persisted here: the file is parsed in memory and discarded. The
 * reviewed facts are written later by `saveProfileFacts`, once the user has
 * confirmed them.
 */
export async function extractResumeFacts(formData: FormData): Promise<ExtractResult> {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "missing-file" };
  if (file.size > MAX_BYTES) return { ok: false, reason: "too-large" };

  const format = formatFor(file);
  if (!format) return { ok: false, reason: "unsupported-type" };

  try {
    const { text, ocr } = await readResumeText(new Uint8Array(await file.arrayBuffer()), format);

    let extraction: ResumeProposal | null = null;
    if (aiExtractionEnabled()) {
      try {
        extraction = await extractWithAi(text, file.name);
      } catch (error) {
        console.error("AI extraction failed, using text rules", error instanceof Error ? error.message : error);
      }
    }

    extraction ??= proposeFactsFromResume(text, file.name);
    extraction = sanitizeProposal(extraction);
    if (ocr) extraction = { ...extraction, ocr: true };
    if (extraction.facts.length === 0) return { ok: false, reason: "no-facts" };
    return { ok: true, extraction };
  } catch (error) {
    if (error instanceof ResumeReadError) return { ok: false, reason: error.reason };
    console.error("Resume extraction failed", error instanceof Error ? error.message : error);
    return { ok: false, reason: "unreadable" };
  }
}
