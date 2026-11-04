import { NextResponse } from "next/server";

import { checkResume } from "@/lib/documents/ats";
import { extractSkills } from "@/lib/jobs/skills";
import { readResumeText, ResumeReadError } from "@/lib/resume/read-text";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

function formatFor(file: File): "pdf" | "docx" | null {
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

/**
 * Score an uploaded resume the way a parser would read it.
 *
 * The file is read in memory and discarded: nothing is stored, and no text
 * leaves this server. The report is the same deterministic check used on
 * generated resumes, so the two scores are comparable.
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Sign in to scan a resume." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("resume");
  const role = String(form?.get("role") ?? "").trim().slice(0, 120);

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Choose a PDF or DOCX resume." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "That file is over 10 MB." }, { status: 400 });
  }

  const format = formatFor(file);
  if (!format) {
    return NextResponse.json({ ok: false, error: "Only PDF and DOCX are supported." }, { status: 400 });
  }

  try {
    const { text } = await readResumeText(new Uint8Array(await file.arrayBuffer()), format);
    if (text.trim().length < 120) {
      return NextResponse.json(
        { ok: false, error: "No readable text found. Scanned PDFs need a text layer." },
        { status: 422 },
      );
    }

    const report = checkResume({ content: text, jobSkills: extractSkills(role, 12) });
    return NextResponse.json(
      {
        ok: true,
        role: role || null,
        words: text.split(/\s+/).filter(Boolean).length,
        report,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ResumeReadError) {
      return NextResponse.json({ ok: false, error: "That file could not be read." }, { status: 422 });
    }
    console.error("ATS scan failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "The scan failed. Try again." }, { status: 500 });
  }
}
