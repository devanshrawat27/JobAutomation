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
});

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
  });

  if (!parsed.success) redirect("/jobs?error=decision");

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
  redirect("/jobs");
}

/**
 * Scan every public board now, then reload the list.
 *
 * The background worker does this on a timer; this is the manual version for
 * whoever wants the corpus refreshed immediately.
 */
export async function scanNow(): Promise<void> {
  await scanBoards();
  revalidatePath("/jobs");
  redirect("/jobs");
}
