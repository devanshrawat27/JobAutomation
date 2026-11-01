"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { importJobLink } from "@/lib/jobs/import-link";
import { getCurrentSession } from "@/lib/session";

const schema = z.object({ url: z.string().trim().url().max(2000) });

/**
 * Import the posting behind a pasted link.
 *
 * A posting the candidate chose to add belongs to them, so it is stored with
 * their account in mind even though the corpus is shared: the row is the same
 * shape as a scanned one, which is what keeps the score and the card identical.
 */
export async function importJob(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in?next=%2Fjobs");

  const parsed = schema.safeParse({ url: formData.get("url") });
  if (!parsed.success) redirect("/jobs?error=import-format");

  const result = await importJobLink(parsed.data.url);
  if (!result.ok) {
    redirect(`/jobs?error=import-${result.reason}`);
  }

  const { job } = result;
  const hash = `link-${job.source}-${job.externalId}`;

  await prisma.jobPosting.upsert({
    where: {
      source_board_externalId: {
        source: job.source,
        board: job.board,
        externalId: job.externalId,
      },
    },
    create: {
      source: job.source,
      board: job.board,
      externalId: job.externalId,
      company: job.company,
      title: job.title,
      location: job.location,
      department: job.department,
      url: job.url,
      description: job.content,
      skills: job.skills,
      seniority: job.seniority,
      yearsMin: job.yearsMin,
      remote: job.remote,
      postedAt: job.postedAt ?? new Date(),
      hash,
      lastSeenAt: new Date(),
    },
    update: {
      title: job.title,
      location: job.location,
      department: job.department,
      url: job.url,
      description: job.content,
      skills: job.skills,
      seniority: job.seniority,
      yearsMin: job.yearsMin,
      remote: job.remote,
      hash,
      lastSeenAt: new Date(),
      closedAt: null,
    },
  });

  revalidatePath("/jobs");
  redirect(`/jobs?view=for-you&imported=${encodeURIComponent(`${job.source}/${job.board}/${job.externalId}`)}`);
}
