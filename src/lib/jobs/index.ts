import "server-only";

import { BOARDS } from "@/lib/jobs/boards";
import { greenhouseAdapter } from "@/lib/jobs/greenhouse";
import { ashbyAdapter } from "@/lib/jobs/ashby";
import { hnAdapter } from "@/lib/jobs/hn";
import { leverAdapter } from "@/lib/jobs/lever";
import { mastodonAdapter } from "@/lib/jobs/mastodon";
import type { BoardRef, BoardResult, JobPosting } from "@/lib/jobs/types";

const TTL_MS = 10 * 60 * 1000;

type CacheEntry = { postings: JobPosting[]; fetchedAt: number };
const cache = new Map<string, CacheEntry>();

async function listBoard(board: BoardRef): Promise<BoardResult> {
  const key = `${board.source}:${board.token}`;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return { board, postings: cached.postings, fetchedAt: new Date(cached.fetchedAt).toISOString() };
  }

  try {
    // Each source reads its own endpoint; the fallback used to ask Greenhouse
    // for the Hacker News board and fail.
    const postings =
      board.source === "hn"
        ? await hnAdapter.listPostings(board)
        : board.source === "mastodon"
          ? await mastodonAdapter.listPostings(board)
          : board.source === "lever"
            ? await leverAdapter.listPostings(board)
            : board.source === "ashby"
              ? await ashbyAdapter.listPostings(board)
              : await greenhouseAdapter.listPostings(board);
    const now = Date.now();
    cache.set(key, { postings, fetchedAt: now });
    return { board, postings, fetchedAt: new Date(now).toISOString() };
  } catch (error) {
    return {
      board,
      postings: [],
      error: error instanceof Error ? error.message : "unknown error",
      fetchedAt: new Date().toISOString(),
    };
  }
}

export type JobSearchInput = {
  query?: string;
  boardToken?: string;
};

export type JobSearchOutput = {
  postings: JobPosting[];
  boards: BoardResult[];
  total: number;
};

function matches(posting: JobPosting, needle: string): boolean {
  return [posting.title, posting.company, posting.location, posting.department]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle));
}

/**
 * Read the configured public boards and filter locally.
 *
 * Discovery only: no application is started, and each posting keeps the URL its
 * employer published.
 */
export async function searchJobs({ query, boardToken }: JobSearchInput = {}): Promise<JobSearchOutput> {
  const selected = boardToken ? BOARDS.filter((board) => board.token === boardToken) : BOARDS;
  const boards = await Promise.all(selected.map(listBoard));

  const needle = query?.trim().toLowerCase() ?? "";
  const postings = boards
    .flatMap((result) => result.postings)
    .filter((posting) => (needle ? matches(posting, needle) : true))
    .sort((left, right) => {
      const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
      const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
      return left.company.localeCompare(right.company) || left.title.localeCompare(right.title);
    });

  return { postings, boards, total: postings.length };
}
