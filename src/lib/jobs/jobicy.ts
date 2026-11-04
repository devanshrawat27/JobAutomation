import { z } from "zod";

import { htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting, JobSourceAdapter } from "@/lib/jobs/types";

const schema = z.object({
  jobs: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      url: z.string().url(),
      jobTitle: z.string(),
      companyName: z.string(),
      jobGeo: z.string().nullish(),
      jobIndustry: z.array(z.string()).nullish(),
      jobDescription: z.string().nullish(),
      pubDate: z.string().nullish(),
      jobLevel: z.string().nullish(),
    }),
  ),
});

/** Jobicy's public remote-job API. */
export const jobicyAdapter: JobSourceAdapter = {
  source: "jobicy",
  async listPostings(board: BoardRef): Promise<JobPosting[]> {
    const response = await fetch("https://jobicy.com/api/v2/remote-jobs?count=100", {
      headers: { accept: "application/json", "user-agent": "jobautomation/0.1 (job search)" },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Jobicy returned ${response.status}`);

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Jobicy returned an unexpected shape");

    return parsed.data.jobs.map((job) => ({
      id: `jobicy:${board.token}:${job.id}`,
      externalId: String(job.id),
      source: "jobicy",
      board: board.token,
      company: job.companyName.trim().slice(0, 120),
      title: job.jobTitle.trim().slice(0, 200),
      location: job.jobGeo?.trim().slice(0, 160) || "Remote",
      department: job.jobIndustry?.[0]?.trim().slice(0, 120) || null,
      url: job.url,
      updatedAt: job.pubDate ?? null,
      content: htmlToText(job.jobDescription ?? "").slice(0, 12_000),
    }));
  },
};
