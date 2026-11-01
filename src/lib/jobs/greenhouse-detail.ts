import "server-only";

import { z } from "zod";

import { findLookalikeWords, htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting } from "@/lib/jobs/types";

const detailSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  absolute_url: z.string().url(),
  updated_at: z.string().nullish(),
  content: z.string().nullish(),
  company_name: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  departments: z.array(z.object({ name: z.string() })).nullish(),
});

export type JobDetail = {
  posting: JobPosting;
  description: string;
  companyName: string | null;
  /** Things a reader should know before trusting this text. */
  warnings: string[];
};

/**
 * Fetch one published posting from a Greenhouse board.
 *
 * `id` is validated as digits so the path can never be redirected elsewhere.
 */
export async function getGreenhouseJob(board: BoardRef, id: string): Promise<JobDetail | null> {
  if (!/^\d{1,20}$/.test(id)) return null;

  const response = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs/${id}`,
    {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Greenhouse posting ${id} returned ${response.status}`);

  const parsed = detailSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error(`Greenhouse posting ${id} returned an unexpected shape`);

  const job = parsed.data;
  const posting: JobPosting = {
    id: `greenhouse:${board.token}:${job.id}`,
    externalId: String(job.id),
    source: "greenhouse",
    board: board.token,
    company: job.company_name?.trim() || board.company,
    title: job.title.trim().slice(0, 200),
    location: job.location?.name?.trim().slice(0, 160) || null,
    department: job.departments?.[0]?.name?.trim().slice(0, 120) || null,
    url: job.absolute_url,
    updatedAt: job.updated_at ?? null,
  };

  const description = htmlToText(job.content ?? "").slice(0, 24_000);
  const lookalikes = findLookalikeWords(description);

  return {
    posting,
    description,
    companyName: job.company_name?.trim() || null,
    warnings: lookalikes.length
      ? [`This posting contains mixed-script words that can imitate Latin text: ${lookalikes.join(", ")}.`]
      : [],
  };
}
