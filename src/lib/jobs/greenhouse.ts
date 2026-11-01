import "server-only";

import { z } from "zod";

import type { BoardRef, JobPosting, JobSourceAdapter } from "@/lib/jobs/types";

const responseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      title: z.string(),
      absolute_url: z.string().url(),
      updated_at: z.string().nullish(),
      location: z.object({ name: z.string().nullish() }).nullish(),
      departments: z.array(z.object({ name: z.string() })).nullish(),
    }),
  ),
});

const BASE = "https://boards-api.greenhouse.io/v1/boards";

/**
 * Greenhouse's public job-board endpoint. It documents no authentication for
 * listing published jobs; reading it grants no right to submit applications.
 */
export const greenhouseAdapter: JobSourceAdapter = {
  source: "greenhouse",

  async listPostings(board: BoardRef, signal?: AbortSignal): Promise<JobPosting[]> {
    const response = await fetch(`${BASE}/${encodeURIComponent(board.token)}/jobs?content=false`, {
      headers: { accept: "application/json" },
      signal: signal ?? AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Greenhouse board "${board.token}" returned ${response.status}`);

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error(`Greenhouse board "${board.token}" returned an unexpected shape`);

    return parsed.data.jobs.map((job) => ({
      id: `greenhouse:${board.token}:${job.id}`,
      externalId: String(job.id),
      source: "greenhouse" as const,
      board: board.token,
      company: board.company,
      title: job.title.trim().slice(0, 200),
      location: job.location?.name?.trim().slice(0, 120) || null,
      department: job.departments?.[0]?.name?.trim().slice(0, 120) || null,
      url: job.absolute_url,
      updatedAt: job.updated_at ?? null,
    }));
  },
};
