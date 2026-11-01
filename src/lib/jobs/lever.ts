import "server-only";

import { htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting } from "@/lib/jobs/types";

/**
 * Lever's public postings API.
 *
 * `https://api.lever.co/v0/postings/<token>?mode=json` is what a company's own
 * careers page calls, so it is the company's published data, not a scrape. The
 * boards registered here are Indian employers with real openings.
 */

type LeverPosting = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  categories?: {
    location?: string;
    team?: string;
    department?: string;
    commitment?: string;
    allLocations?: string[];
  };
  lists?: Array<{ text?: string; content?: string }>;
};

const BASE = "https://api.lever.co/v0/postings";

export const leverAdapter = {
  source: "lever" as const,

  async listPostings(board: BoardRef, signal?: AbortSignal): Promise<JobPosting[]> {
    const response = await fetch(`${BASE}/${encodeURIComponent(board.token)}?mode=json`, {
      headers: { accept: "application/json", "user-agent": "jobautomation/0.1" },
      signal: signal ?? AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`lever/${board.token} returned ${response.status}`);

    const postings = (await response.json()) as LeverPosting[];

    return postings
      .filter((posting) => posting.id && posting.text && posting.hostedUrl)
      .map((posting) => {
        const content = [
          posting.descriptionPlain ?? (posting.description ? htmlToText(posting.description) : ""),
          ...(posting.lists ?? []).map((list) => `${list.text ?? ""}\n${htmlToText(list.content ?? "")}`),
        ]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 12_000);

        const place =
          posting.categories?.allLocations?.join(" / ") ||
          posting.categories?.location ||
          null;

        return {
          id: `lever:${board.token}:${posting.id}`,
          externalId: String(posting.id),
          source: "lever" as const,
          board: board.token,
          company: board.company,
          title: String(posting.text).trim().slice(0, 200),
          location: place ? place.slice(0, 120) : null,
          department: (posting.categories?.team ?? posting.categories?.department ?? null)?.slice(0, 120) ?? null,
          url: posting.hostedUrl as string,
          updatedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
          content,
        };
      });
  },
};
