import "server-only";

import { htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting } from "@/lib/jobs/types";

/**
 * Mastodon hiring hashtags.
 *
 * Public timelines are readable without a token, and the people posting are
 * usually the team itself: "we're hiring a backend engineer, remote, DM me".
 * Only posts that actually name a role are kept, and every entry links back to
 * the original post so the candidate can read the author before applying.
 */

const BASE = "https://mastodon.social/api/v1/timelines/tag";
const UA = "jobautomation/0.1 (hiring-post reader)";

type Status = {
  id?: string;
  url?: string | null;
  content?: string | null;
  created_at?: string | null;
  account?: { acct?: string; display_name?: string } | null;
  tags?: Array<{ name?: string }>;
};

const ROLE =
  /\b(engineer|developer|designer|manager|analyst|scientist|architect|intern|devops|sre|researcher|marketer|writer|recruiter|consultant|lead|fresher)\b/i;
const HIRING = /\b(hiring|job|vacanc(y|ies)|opening|looking for)\b/i;
const REMOTE = /\b(remote|wfh|work from home|anywhere)\b/i;
const CITIES =
  /\b(bengaluru|bangalore|mumbai|pune|delhi|gurugram|noida|hyderabad|chennai|kolkata|ahmedabad|jaipur|indore|kochi|india)\b/i;

const TAGS: Record<string, string[]> = {
  hiring: ["hiring"],
  jobopening: ["jobopening"],
  techjobs: ["techjobs"],
};

export const mastodonAdapter = {
  source: "mastodon" as const,

  async listPostings(board: BoardRef, signal?: AbortSignal): Promise<JobPosting[]> {
    const tag = TAGS[board.token]?.[0] ?? board.token;
    const response = await fetch(`${BASE}/${encodeURIComponent(tag)}?limit=40`, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: signal ?? AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`mastodon #${tag} returned ${response.status}`);

    const statuses = (await response.json()) as Status[];
    const postings: JobPosting[] = [];

    for (const status of statuses) {
      const text = htmlToText(status.content ?? "").trim();
      if (text.length < 60) continue;
      if (!HIRING.test(text) || !ROLE.test(text)) continue;

      const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "Hiring post";
      const cleaned = firstLine
        .replace(/https?:\/\/\S+/g, "")
        .replace(/^[^\p{L}\p{N}]+/u, "")
        .replace(/^\[?\s*(hiring|we[’\']?re hiring|job opening)\s*\]?[:\s-]*/i, "")
        .replace(/#(\w+)/g, "$1")
        .trim();
      const sentence = cleaned.split(/(?<=[!?.])\s/)[0] ?? cleaned;
      const title =
        (sentence.length >= 12 ? sentence : cleaned).replace(/\s{2,}/g, " ").trim().slice(0, 110) || "Hiring post";

      const author = status.account?.acct ?? "mastodon";

      postings.push({
        id: `mastodon:${board.token}:${status.id}`,
        externalId: String(status.id ?? ""),
        source: "mastodon",
        board: board.token,
        company: `@${author}`,
        title,
        location: REMOTE.test(text) ? "Remote" : CITIES.test(text) ? "India" : null,
        department: null,
        url: status.url ?? `https://mastodon.social/@${author}`,
        updatedAt: status.created_at ?? null,
        content: text.slice(0, 12_000),
      });
    }

    return postings;
  },
};
