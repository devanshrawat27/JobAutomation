"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { writeCoverLetter } from "@/lib/documents/cover-letter";
import { unsupportedNumbers } from "@/lib/documents/guard";
import { buildResume } from "@/lib/documents/resume";
import { reviewDocument } from "@/lib/documents/review";
import { BOARDS } from "@/lib/jobs/boards";
import { getGreenhouseJob } from "@/lib/jobs/greenhouse-detail";
import { getCurrentSession } from "@/lib/session";

type Prepared = {
  userId: string;
  postingId: string;
  postingUrl: string;
  postingTitle: string;
  company: string;
  description: string;
  facts: { key: string; groupId: string; label: string; value: string }[];
  previousId: string | null;
  fixes: string[];
};

async function prepareContext(formData: FormData): Promise<Prepared> {
  const boardToken = String(formData.get("board") ?? "");
  const postingId = String(formData.get("id") ?? "");
  const backTo = `/jobs/${encodeURIComponent(boardToken)}/${encodeURIComponent(postingId)}/prepare`;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(backTo)}`);

  const board = BOARDS.find((entry) => entry.token === boardToken);
  if (!board) redirect("/jobs");

  const detail = await getGreenhouseJob(board, postingId).catch(() => null);
  if (!detail) redirect("/jobs");

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
    orderBy: { position: "asc" },
    select: { key: true, groupId: true, label: true, value: true },
  });
  if (facts.length === 0) redirect("/onboarding");

  const previousRaw = String(formData.get("previousId") ?? "");
  const previous = previousRaw
    ? await prisma.document.findFirst({ where: { id: previousRaw, userId: session.user.id }, select: { id: true } })
    : null;

  const fixesRaw = String(formData.get("fixes") ?? "");
  let fixes: string[] = [];
  if (fixesRaw) {
    try {
      const parsed: unknown = JSON.parse(fixesRaw);
      if (Array.isArray(parsed)) {
        fixes = parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).slice(0, 8);
      }
    } catch {
      fixes = [];
    }
  }

  return {
    userId: session.user.id,
    postingId: detail.posting.id,
    postingUrl: detail.posting.url,
    postingTitle: detail.posting.title,
    company: detail.posting.company,
    description: detail.description,
    facts,
    previousId: previous?.id ?? null,
    fixes,
  };
}

/** Draft a cover letter for one posting, store it with the facts it cites, then open it. */
export async function createCoverLetter(formData: FormData): Promise<void> {
  const context = await prepareContext(formData);
  const backTo = `/jobs/${encodeURIComponent(context.postingId.split(":")[1])}/${encodeURIComponent(context.postingId.split(":")[2])}/prepare`;

  let letter;
  try {
    letter = await writeCoverLetter({
      title: context.postingTitle,
      company: context.company,
      description: context.description,
      facts: context.facts.map((fact) => ({ key: fact.key, group: fact.groupId, label: fact.label, value: fact.value })),
      fixes: context.fixes,
    });
  } catch (error) {
    console.error("Cover letter generation failed", error instanceof Error ? error.message : error);
    redirect(`${backTo}?error=generate`);
  }

  let review = null;
  try {
    review = await reviewDocument(
      letter.content,
      context.facts.map((fact) => ({ label: fact.label, value: fact.value })),
      context.postingTitle,
    );
  } catch (error) {
    console.error("Cover letter review failed", error instanceof Error ? error.message : error);
  }

  const document = await prisma.document.create({
    data: {
      userId: context.userId,
      kind: "COVER_LETTER",
      postingId: context.postingId,
      postingUrl: context.postingUrl,
      postingTitle: context.postingTitle.slice(0, 200),
      company: context.company.slice(0, 120),
      content: letter.content,
      factKeys: letter.citedKeys,
      previousId: context.previousId,
      ...(review ? { review } : {}),
      model: process.env["GEMINI_MODEL"] ?? "gemini-3.5-flash-lite",
    },
    select: { id: true },
  });

  revalidatePath("/documents");
  redirect(`/documents/${document.id}`);
}

/** Build a job-targeted resume from the same confirmed facts. */
export async function createResume(formData: FormData): Promise<void> {
  const context = await prepareContext(formData);
  const backTo = `/jobs/${encodeURIComponent(context.postingId.split(":")[1])}/${encodeURIComponent(context.postingId.split(":")[2])}/prepare`;

  let resume;
  try {
    resume = await buildResume({
      title: context.postingTitle,
      company: context.company,
      description: context.description,
      facts: context.facts.map((fact) => ({ key: fact.key, group: fact.groupId, label: fact.label, value: fact.value })),
      fixes: context.fixes,
    });
  } catch (error) {
    console.error("Resume generation failed", error instanceof Error ? error.message : error);
    redirect(`${backTo}?error=resume`);
  }

  let review = null;
  try {
    review = await reviewDocument(
      resume.plainText,
      context.facts.map((fact) => ({ label: fact.label, value: fact.value })),
      context.postingTitle,
      "resume",
    );
  } catch (error) {
    console.error("Resume review failed", error instanceof Error ? error.message : error);
  }

  const document = await prisma.document.create({
    data: {
      userId: context.userId,
      kind: "RESUME",
      postingId: context.postingId,
      postingUrl: context.postingUrl,
      postingTitle: context.postingTitle.slice(0, 200),
      company: context.company.slice(0, 120),
      content: resume.plainText,
      data: {
        headline: resume.headline,
        summary: resume.summary,
        sections: resume.sections,
        flags: resume.flags,
      },
      factKeys: resume.citedKeys,
      previousId: context.previousId,
      ...(review ? { review } : {}),
      model: process.env["GEMINI_MODEL"] ?? "gemini-3.5-flash-lite",
    },
    select: { id: true },
  });

  revalidatePath("/documents");
  redirect(`/documents/${document.id}`);
}

/** Rebuild a document from the posting and the profile as it is now. */
export async function rebuildDocument(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(`/documents/${id}`)}`);

  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, kind: true, postingId: true },
  });
  if (!document) redirect("/documents");

  const [, boardToken, postingId] = document.postingId.split(":");
  if (!boardToken || !postingId) redirect("/documents");

  const next = new FormData();
  next.set("board", boardToken);
  next.set("id", postingId);
  next.set("previousId", document.id);

  // Both generators redirect when they finish (to the new document) or fail.
  return document.kind === "RESUME" ? createResume(next) : createCoverLetter(next);
}

/** Regenerate a document, passing the reviewer's notes back into the prompt. */
export async function regenerateWithFixes(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const backTo = `/documents/${encodeURIComponent(id)}`;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(backTo)}`);

  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, kind: true, postingId: true, review: true },
  });
  if (!document) redirect("/documents");

  const review = document.review as { issues?: Array<{ severity: string; problem: string; fix: string }> } | null;
  const fixes = (review?.issues ?? [])
    .filter((issue) => issue.severity !== "low")
    .map((issue) => `${issue.problem} ${issue.fix}`.trim())
    .filter(Boolean)
    .slice(0, 8);

  const [, boardToken, postingId] = document.postingId.split(":");
  if (!boardToken || !postingId) redirect("/documents");

  const next = new FormData();
  next.set("board", boardToken);
  next.set("id", postingId);
  next.set("previousId", document.id);
  if (fixes.length > 0) next.set("fixes", JSON.stringify(fixes));

  return document.kind === "RESUME" ? createResume(next) : createCoverLetter(next);
}

/** Save user edits to a cover letter, re-checking every number against its facts. */
export async function updateDocumentContent(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const content = z.string().min(40).max(8000).safeParse(String(formData.get("content") ?? ""));
  const backTo = `/documents/${encodeURIComponent(id)}`;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(backTo)}`);
  if (!content.success) redirect(`${backTo}?error=content`);

  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, factKeys: true },
  });
  if (!document) redirect("/documents");

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id, key: { in: document.factKeys } },
    select: { value: true },
  });

  const unsupported = unsupportedNumbers(
    content.data,
    facts.map((fact) => fact.value),
  );
  if (unsupported.length > 0) {
    redirect(`${backTo}?error=numbers&numbers=${encodeURIComponent(unsupported.slice(0, 3).join(", "))}`);
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { content: content.data, editedAt: new Date() },
  });

  revalidatePath(backTo);
  revalidatePath("/documents");
  redirect(`${backTo}?saved=1`);
}
