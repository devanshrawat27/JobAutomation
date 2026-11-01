import "server-only";

import { htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting } from "@/lib/jobs/types";

/**
 * Ashby's public job-board API — the same JSON a company's own careers page
 * reads. Used for remote-first teams whose roles are open to candidates outside
 * their own country.
 */

type AshbyJob = {
  id?: string;
  title?: string;
  location?: string | null;
  secondaryLocations?: Array<{ location?: string }>;
  department?: string | null;
  team?: string | null;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
  publishedAt?: string | null;
  employmentType?: string | null;
  isRemote?: boolean;
  isListed?: boolean;
  jobUrl?: string | null;
  applyUrl?: string | null;
};

const BASE = "https://api.ashbyhq.com/posting-api/job-board";

export const ashbyAdapter = {
  source: "ashby" as const,

  async listPostings(board: BoardRef, signal?: AbortSignal): Promise<JobPosting[]> {
    const response = await fetch(`${BASE}/${encodeURIComponent(board.token)}?includeCompensation=true`, {
      headers: { accept: "application/json", "user-agent": "jobautomation/0.1" },
      signal: signal ?? AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`ashby/${board.token} returned ${response.status}`);

    const payload = (await response.json()) as { jobs?: AshbyJob[] };

    return (payload.jobs ?? [])
      .filter((job) => job.isListed !== false && job.id && job.title)
      .map((job) => {
        const places = [job.location, ...(job.secondaryLocations ?? []).map((entry) => entry.location)]
          .filter(Boolean)
          .join(" / ");

        const content = (job.descriptionPlain ?? (job.descriptionHtml ? htmlToText(job.descriptionHtml) : "")).slice(
          0,
          12_000,
        );

        return {
          id: `ashby:${board.token}:${job.id}`,
          externalId: String(job.id),
          source: "ashby" as const,
          board: board.token,
          company: board.company,
          title: String(job.title).trim().slice(0, 200),
          location: places ? places.slice(0, 120) : job.isRemote ? "Remote" : null,
          department: (job.department ?? job.team ?? null)?.slice(0, 120) ?? null,
          url: (job.jobUrl ?? job.applyUrl ?? `https://jobs.ashbyhq.com/${board.token}`) as string,
          updatedAt: job.publishedAt ?? null,
          content,
        };
      });
  },
};
