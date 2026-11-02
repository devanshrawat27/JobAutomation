import "server-only";

import { htmlToText } from "@/lib/jobs/html";
import type { BoardRef, JobPosting } from "@/lib/jobs/types";

/**
 * SmartRecruiters' public company API.
 *
 * The list endpoint is cheap; a posting's own text needs a second call, so only
 * postings inside the freshness window are expanded, and only up to a cap. Two
 * Indian employers publish here (Freshworks, Swiggy) where Greenhouse and Lever
 * have nothing.
 */

const BASE = "https://api.smartrecruiters.com/v1/companies";
const UA = "jobautomation/0.1 (public board reader)";
const MAX_DETAILS = 40;
const WINDOW_DAYS = 14;

type Listing = {
  id?: string;
  name?: string;
  releasedDate?: string;
  location?: { city?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string } | null;
  department?: { label?: string } | null;
  ref?: string | null;
};

type Detail = {
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { text?: string } | undefined> } | null;
};

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`returned ${response.status}`);
  return response.json();
}

export async function smartRecruitersPostings(board: BoardRef): Promise<JobPosting[]> {
  const listing = (await getJson(
    `${BASE}/${encodeURIComponent(board.token)}/postings?limit=100`,
  )) as { content?: Listing[] };
  const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;

  const fresh = (listing.content ?? []).filter((entry) => {
    if (!entry.id || !entry.name) return false;
    const released = entry.releasedDate ? Date.parse(entry.releasedDate) : NaN;
    return Number.isNaN(released) || released >= cutoff;
  });

  const details = await Promise.all(
    fresh.slice(0, MAX_DETAILS).map(async (entry) => {
      try {
        const detail = (await getJson(
          `${BASE}/${encodeURIComponent(board.token)}/postings/${encodeURIComponent(entry.id!)}`,
        )) as Detail;
        return { entry, detail };
      } catch {
        return { entry, detail: null };
      }
    }),
  );

  return details.map(({ entry, detail }) => {
    const sections = detail?.jobAd?.sections ?? {};
    const content = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"]
      .map((key) => (sections[key]?.text ? htmlToText(sections[key]!.text!) : ""))
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12_000);

    const rawPlace =
      entry.location?.fullLocation ||
      [entry.location?.city, entry.location?.country?.toUpperCase()].filter(Boolean).join(", ") ||
      (entry.location?.remote ? "Remote" : null);
    // SmartRecruiters ships "Chennai, , India"; keep one comma.
    const place = rawPlace ? rawPlace.replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").replace(/,\s*$/, "").trim() : null;

    return {
      id: `smartrecruiters:${board.token}:${entry.id}`,
      externalId: String(entry.id),
      source: "smartrecruiters" as const,
      board: board.token,
      company: board.company,
      title: String(entry.name).trim().slice(0, 200),
      location: place ? place.slice(0, 120) : null,
      department: entry.department?.label?.slice(0, 120) ?? null,
      url:
        detail?.postingUrl ??
        `https://jobs.smartrecruiters.com/${encodeURIComponent(board.token)}/${encodeURIComponent(entry.id!)}`,
      updatedAt: entry.releasedDate ?? null,
      content,
    };
  });
}
