import { z } from "zod";

import { htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting, JobSourceAdapter } from "@/lib/jobs/types";

const schema = z.object({
  jobs: z.array(
    z.object({
      guid: z.string(),
      title: z.string(),
      companyName: z.string(),
      companySlug: z.string().nullish(),
      description: z.string().nullish(),
      applicationLink: z.string().url().nullish(),
      pubDate: z.union([z.string(), z.number()]).nullish(),
      locationRestrictions: z.array(z.string()).nullish(),
      categories: z.array(z.string()).nullish(),
      seniority: z.array(z.string()).nullish(),
    }),
  ),
});

/**
 * Himalayas' public remote-job API. The stored link is the employer's
 * application link when one is given.
 */
export const himalayasAdapter: JobSourceAdapter = {
  source: "himalayas",
  async listPostings(board: BoardRef): Promise<JobPosting[]> {    const response = await fetch("https://himalayas.app/jobs/api?limit=100", {
      headers: { accept: "application/json", "user-agent": "jobautomation/0.1 (job search)" },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Himalayas returned ${response.status}`);

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Himalayas returned an unexpected shape");

    return parsed.data.jobs.map((job) => {
      const restrictions = (job.locationRestrictions ?? []).filter(Boolean);
      const location = restrictions.length > 0 ? restrictions.join(", ").slice(0, 160) : "Remote";

      return {
        id: `himalayas:${board.token}:${job.guid}`,
        externalId: job.guid,
        source: "himalayas",
        board: board.token,
        company: job.companyName.trim().slice(0, 120),
        title: job.title.trim().slice(0, 200),
        location,
        department: job.categories?.[0]?.trim().slice(0, 120) || null,
        url:
          job.applicationLink ??
          `https://himalayas.app/companies/${job.companySlug ?? "remote"}/jobs/${job.guid}`,
        updatedAt:
          typeof job.pubDate === "number"
            ? new Date(job.pubDate * 1000).toISOString()
            : job.pubDate ?? null,
        content: htmlToText(job.description ?? "").slice(0, 12_000),
      };
    });
  },
};
