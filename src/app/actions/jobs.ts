"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { scanBoards } from "@/lib/jobs/ingest";
import { getCurrentSession } from "@/lib/session";

const schema = z.object({
  postingId: z.string().min(3).max(200),
  board: z.string().min(1).max(60),
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(120),
  location: z.string().max(160).optional(),
  url: z.string().url().max(2000),
  decision: z.enum(["saved", "dismissed", "clear"]),
  returnTo: z.string().max(200).optional(),
});

/** Only same-site paths, so a crafted form cannot use this as an open redirect. */
function safeReturn(value: string | undefined, fallback: string): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/**
 * Save, dismiss, or clear a decision about one posting. Discovery never applies
 * to a job; this only remembers what the candidate chose to keep or hide.
 */
export async function setJobDecision(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in?next=%2Fjobs");

  const parsed = schema.safeParse({
    postingId: formData.get("postingId"),
    board: formData.get("board"),
    title: formData.get("title"),
    company: formData.get("company"),
    location: formData.get("location") || undefined,
    url: formData.get("url"),
    decision: formData.get("decision"),
    returnTo: formData.get("returnTo") || undefined,
  });

  const backTo = safeReturn(
    parsed.success ? parsed.data.returnTo : undefined,
    "/jobs",
  );
  if (!parsed.success) redirect(`${backTo}?error=decision`);

  const { postingId, board, title, company, location, url, decision } = parsed.data;

  if (decision === "clear") {
    await prisma.jobDecision.deleteMany({ where: { userId: session.user.id, postingId } });
  } else {
    await prisma.jobDecision.upsert({
      where: { userId_postingId: { userId: session.user.id, postingId } },
      create: {
        userId: session.user.id,
        postingId,
        board,
        title,
        company,
        location: location ?? null,
        url,
        status: decision === "saved" ? "SAVED" : "DISMISSED",
      },
      update: { status: decision === "saved" ? "SAVED" : "DISMISSED" },
    });
  }

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect(backTo);
}

/**
 * Manual scan, for a signed-in user who wants the corpus refreshed now.
 *
 * The scheduled worker uses the secret-protected endpoint instead. Two guards
 * here: only a real session may trigger external work, and one account cannot
 * ask more than once every two minutes. A scan already in progress is reported
 * rather than queued.
 */
const recentManualScans = new Map<string, number>();
const MANUAL_SCAN_COOLDOWN_MS = 2 * 60 * 1000;

export async function scanNow(): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in?next=%2Fjobs");

  const last = recentManualScans.get(session.user.id) ?? 0;
  if (Date.now() - last < MANUAL_SCAN_COOLDOWN_MS) {
    redirect("/jobs?error=scan-wait");
  }

  const summary = await scanBoards("manual");
  if (!summary) redirect("/jobs?error=scan-busy");

  recentManualScans.set(session.user.id, Date.now());
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect("/jobs");
}
