import "server-only";

import { prisma } from "@/lib/db";
import { BOARDS } from "@/lib/jobs/boards";
import { getGreenhouseJob, type JobDetail } from "@/lib/jobs/greenhouse-detail";
import { findLookalikeWords } from "@/lib/jobs/html";
import { visiblePostings } from "@/lib/jobs/visibility";
import type { JobPosting, JobSourceId } from "@/lib/jobs/types";

export { visiblePostings };

/**
 * One resolver for every posting the product can show.
 *
 * Detail, preparation, answers and the extension all used to reach straight for
 * the Greenhouse API, which meant an imported Lever role, a Swiggy listing or a
 * captured LinkedIn post could not be prepared from. The stored corpus is the
 * authority; a live board read only happens when the row is absent.
 */

export type ResolvedJob = JobDetail & {
  /** Where the body came from, so the page can say so honestly. */
  origin: "corpus" | "board";
  postedAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  ownerUserId: string | null;
  /** Lakhs per annum, when the posting states pay. */
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
  seniority: string | null;
  yearsMin: number | null;
  remote: boolean;
};

const SOURCE_IDS: ReadonlySet<string> = new Set<JobSourceId>([
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "smartrecruiters",
  "hn",
  "manual",
  "mastodon",
]);

function asSource(value: string): JobSourceId {
  return (SOURCE_IDS.has(value) ? value : "manual") as JobSourceId;
}

/**
 * Resolve one posting by the pair used in every URL: board token + posting id.
 *
 * `viewerId` is the signed-in user, or null for a signed-out visitor. A row that
 * belongs to another account is treated as missing rather than forbidden, so a
 * guessed URL cannot confirm that someone else saved it.
 */
export async function getJobDetail(
  boardToken: string,
  externalId: string,
  viewerId: string | null,
): Promise<ResolvedJob | null> {
  if (!boardToken || !externalId) return null;
  if (boardToken.length > 80 || externalId.length > 200) return null;

  const stored = await prisma.jobPosting.findFirst({
    where: { board: boardToken, externalId },
    select: {
      id: true,
      source: true,
      board: true,
      externalId: true,
      ownerUserId: true,
      company: true,
      title: true,
      location: true,
      department: true,
      url: true,
      description: true,
      postedAt: true,
      firstSeenAt: true,
      lastSeenAt: true,
      salaryMin: true,
      salaryMax: true,
      skills: true,
      seniority: true,
      yearsMin: true,
      remote: true,
    },
  });

  if (stored) {
    if (stored.ownerUserId && stored.ownerUserId !== viewerId) return null;

    return {
      posting: {
        id: `${stored.source}:${stored.board}:${stored.externalId}`,
        externalId: stored.externalId,
        source: asSource(stored.source),
        board: stored.board,
        company: stored.company,
        title: stored.title,
        location: stored.location,
        department: stored.department,
        url: stored.url,
        updatedAt: (stored.postedAt ?? stored.firstSeenAt).toISOString(),
      },
      description: stored.description,
      companyName: stored.company,
      warnings: findLookalikeWords(stored.description.slice(0, 4000)).length
        ? ["This posting contains mixed-script lookalike characters."]
        : [],
      origin: "corpus",
      postedAt: stored.postedAt ? stored.postedAt.toISOString() : null,
      firstSeenAt: stored.firstSeenAt.toISOString(),
      lastSeenAt: stored.lastSeenAt.toISOString(),
      ownerUserId: stored.ownerUserId,
      salaryMin: stored.salaryMin,
      salaryMax: stored.salaryMax,
      skills: stored.skills,
      seniority: stored.seniority,
      yearsMin: stored.yearsMin,
      remote: stored.remote,
    };
  }

  // Nothing stored: only a Greenhouse board can be read live, and only by its
  // real token. This keeps a typo'd path from being turned into a request.
  const board = BOARDS.find((entry) => entry.token === boardToken);
  if (board?.source !== "greenhouse") return null;

  const live = await getGreenhouseJob(board, externalId);
  if (!live) return null;

  return {
    ...live,
    origin: "board",
    postedAt: live.posting.updatedAt,
    firstSeenAt: null,
    lastSeenAt: null,
    ownerUserId: null,
    salaryMin: null,
    salaryMax: null,
    skills: [],
    seniority: null,
    yearsMin: null,
    remote: false,
  };
}

type PostingForLink = Pick<JobPosting, "board" | "externalId">;

/** The canonical URL for a stored posting, used after an action. */
export function postingPath(posting: PostingForLink): string {
  return `/jobs/${posting.board}/${posting.externalId}`;
}
