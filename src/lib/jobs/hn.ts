import "server-only";

import { findLookalikeWords, htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting } from "@/lib/jobs/types";

/**
 * Hacker News "Who is hiring?" — the monthly thread where founders, hiring
 * managers and team leads post a role themselves.
 *
 * That is a different channel from an ATS board: far fewer applicants, and the
 * person reading your message is usually the person who would hire you. The
 * thread is public and Hacker News publishes a read API through Algolia, so we
 * read it the way the site intends: one story, its comments, nothing scraped
 * from behind a login.
 */

const ALGOLIA = "https://hn.algolia.com/api/v1";
const THREAD = "Ask HN: Who is hiring?";

type AlgoliaHit = { objectID: string; title?: string | null; created_at?: string | null };
type AlgoliaSearch = { hits: AlgoliaHit[] };
type HnItem = {
  id: number;
  created_at?: string | null;
  text?: string | null;
  children?: HnItem[];
};

const ROLE = /\b(engineer|developer|designer|manager|analyst|scientist|architect|intern|lead|devops|sre|researcher|marketer|writer|recruiter|consultant)\b/i;
const REMOTE = /\b(remote|anywhere|distributed)\b/i;
const CITIES =
  /\b(bengaluru|bangalore|mumbai|pune|delhi|gurugram|noida|hyderabad|chennai|kolkata|ahmedabad|jaipur|indore|kochi|india)\b/i;
const LOCATION_LINE =
  /\b(remote|hybrid|onsite|on-site|anywhere|bengaluru|bangalore|mumbai|pune|delhi|gurugram|noida|hyderabad|chennai|kolkata|india|usa|us|uk|london|berlin|canada|europe|singapore|dubai)\b/i;

function firstLine(text: string): string {
  return text.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "";
}

/** Comment headers are written by hand: "Acme | Senior Engineer | Remote | $180k". */
function cleanTitle(value: string): string {
  let title = value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/\b(is (looking for|hiring)|we are hiring|hiring)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[|,;:\-–—]+$/g, "")
    .trim();

  const sentence = title.split(/\.\s/)[0];
  if (sentence && sentence.length >= 8) title = sentence;

  return title.slice(0, 110).trim();
}

/** "Acme | Senior Backend Engineer | Remote" -> { company, title, location }. */
function parseHeader(text: string): { company: string; title: string; location: string | null } {
  const header = firstLine(text).slice(0, 220);
  const parts = header
    .split(/\s*[|·•—–]\s*|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const company = cleanTitle(parts[0] ?? "").slice(0, 60) || "Hacker News post";
  const roleIndex = parts.findIndex((part, index) => index > 0 && ROLE.test(part));
  const rawTitle = roleIndex > 0 ? parts[roleIndex]! : (parts[1] ?? header);
  const title = cleanTitle(rawTitle) || cleanTitle(header);

  const locationPart =
    parts.find((part) => LOCATION_LINE.test(part) && !ROLE.test(part)) ??
    text.match(/location[:\s]+([^\n]{2,80})/i)?.[1] ??
    null;

  return { company, title, location: locationPart ? locationPart.slice(0, 120) : null };
}

export const hnAdapter = {
  source: "hn" as const,

  async listPostings(board: BoardRef, signal?: AbortSignal): Promise<JobPosting[]> {
    const timeout = signal ?? AbortSignal.timeout(20_000);

    // search_by_date returns newest first; relevance search happily returns a
    // 2016 thread, which is not the one people are reading today.
    const search = await fetch(
      `${ALGOLIA}/search_by_date?query=${encodeURIComponent(THREAD)}&tags=story&hitsPerPage=12`,
      { headers: { accept: "application/json" }, signal: timeout, cache: "no-store" },
    );
    if (!search.ok) throw new Error(`Hacker News search returned ${search.status}`);

    const hits = ((await search.json()) as AlgoliaSearch).hits ?? [];
    const story = hits.find((hit) => (hit.title ?? "").toLowerCase().startsWith(THREAD.toLowerCase()));
    if (!story) return [];

    const thread = await fetch(`${ALGOLIA}/items/${story.objectID}`, {
      headers: { accept: "application/json" },
      signal: timeout,
      cache: "no-store",
    });
    if (!thread.ok) throw new Error(`Hacker News thread returned ${thread.status}`);

    const item = (await thread.json()) as HnItem;
    const postings: JobPosting[] = [];

    for (const comment of item.children ?? []) {
      const text = htmlToText(comment.text ?? "");
      if (text.length < 80) continue;

      const { company, title, location } = parseHeader(text);
      // A header that names no role is a reply or a "me too" comment, not a job.
      if (!ROLE.test(title)) continue;

      postings.push({
        id: `hn:${board.token}:${comment.id}`,
        externalId: String(comment.id),
        source: "hn",
        board: board.token,
        company,
        title,
        location: location ?? (REMOTE.test(text.slice(0, 400)) ? "Remote" : CITIES.test(text) ? "India" : null),
        department: null,
        url: `https://news.ycombinator.com/item?id=${comment.id}`,
        updatedAt: comment.created_at ?? story.created_at ?? null,
        content: text.slice(0, 12_000),
      });
    }

    return postings;
  },
};

export function hnWarnings(text: string): string[] {
  return findLookalikeWords(text);
}
