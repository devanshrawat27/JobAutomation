import { z } from "zod";

import { htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting, JobSourceAdapter } from "@/lib/jobs/types";

const schema = z.object({
  jobs: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      url: z.string().url(),
      title: z.string(),
      company_name: z.string(),
      category: z.string().nullish(),
      tags: z.array(z.string()).nullish(),
      job_type: z.string().nullish(),
      publication_date: z.string().nullish(),
      candidate_required_location: z.string().nullish(),
      description: z.string().nullish(),
    }),
  ),
});

/**
 * Remotive's public remote-job API. No key, no account: the terms ask for a
 * link back to the listing, which the stored URL provides.
 */
export const remotiveAdapter: JobSourceAdapter = {
  source: "remotive",
  async listPostings(board: BoardRef): Promise<JobPosting[]> {
    const response = await fetch("https://remotive.com/api/remote-jobs?limit=100", {
      headers: { accept: "application/json", "user-agent": "jobautomation/0.1 (job search)" },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Remotive returned ${response.status}`);

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Remotive returned an unexpected shape");

    return parsed.data.jobs.map((job) => ({
      id: `remotive:${board.token}:${job.id}`,
      externalId: String(job.id),
      source: "remotive",
      board: board.token,
      company: job.company_name.trim().slice(0, 120),
      title: job.title.trim().slice(0, 200),
      location: job.candidate_required_location?.trim().slice(0, 160) || "Remote",
      department: job.category?.trim().slice(0, 120) || null,
      url: job.url,
      updatedAt: job.publication_date ?? null,
      content: htmlToText(job.description ?? "").slice(0, 12_000),
    }));
  },
};
