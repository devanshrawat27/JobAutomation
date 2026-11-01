import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { BOARDS } from "@/lib/jobs/boards";
import { htmlToText } from "@/lib/jobs/html";
import { ashbyAdapter } from "@/lib/jobs/ashby";
import { hnAdapter } from "@/lib/jobs/hn";
import { leverAdapter } from "@/lib/jobs/lever";
import { mastodonAdapter } from "@/lib/jobs/mastodon";
import { seniorityOf } from "@/lib/jobs/match";
import { extractSkills } from "@/lib/jobs/skills";
import type { BoardRef } from "@/lib/jobs/types";
import { requiredYears } from "@/lib/match/experience";

/**
 * Scan every configured source and keep what we found.
 *
 * Two kinds of source, one shape: an employer's own ATS board, and the monthly
 * Hacker News "Who is hiring?" thread where founders and hiring managers post
 * directly. Both are public and both end at the employer, never at an
 * aggregator. Postings are diffed, not re-fetched on every page view.
 */

const jobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  absolute_url: z.string().url(),
  updated_at: z.string().nullish(),
  content: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  departments: z.array(z.object({ name: z.string() })).nullish(),
});

const boardSchema = z.object({ jobs: z.array(jobSchema) });

const BASE = "https://boards-api.greenhouse.io/v1/boards";
const MAX_DESCRIPTION = 12_000;

/** Nothing older than this is stored or kept: the product only lists live roles. */
export const MAX_AGE_DAYS = 14;

type RawPosting = {
  externalId: string;
  company: string | null;
  title: string;
  location: string | null;
  department: string | null;
  url: string;
  content: string;
  postedAt: string | null;
};

export type ScanBoardResult = {
  board: string;
  source: string;
  company: string;
  seen: number;
  created: number;
  updated: number;
  error?: string;
};

export type ScanSummary = {
  scanId: string;
  startedAt: string;
  endedAt: string;
  boards: ScanBoardResult[];
  seen: number;
  created: number;
  updated: number;
  closed: number;
  errors: string[];
};

function trim(value: string | null | undefined, max: number): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function hashOf(parts: Array<string | null>): string {
  return createHash("sha1").update(parts.join("\u0000")).digest("hex");
}

async function greenhousePostings(board: BoardRef): Promise<RawPosting[]> {
  const response = await fetch(`${BASE}/${encodeURIComponent(board.token)}/jobs?content=true`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`returned ${response.status}`);

  const parsed = boardSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("returned an unexpected shape");

  return parsed.data.jobs.map((job) => ({
    externalId: String(job.id),
    company: null,
    title: job.title.trim().slice(0, 200),
    location: trim(job.location?.name, 120),
    department: trim(job.departments?.[0]?.name, 120),
    url: job.absolute_url,
    content: (job.content ? htmlToText(job.content) : "").slice(0, MAX_DESCRIPTION),
    postedAt: job.updated_at ?? null,
  }));
}

async function rawPostings(board: BoardRef): Promise<RawPosting[]> {
  const adapter =
    board.source === "hn"
      ? hnAdapter
      : board.source === "mastodon"
        ? mastodonAdapter
        : board.source === "lever"
          ? leverAdapter
          : board.source === "ashby"
            ? ashbyAdapter
            : null;

  if (adapter) {
    const postings = await adapter.listPostings(board);
    return postings.map((posting) => ({
      externalId: posting.externalId,
      company: posting.company,
      title: posting.title,
      location: posting.location,
      department: posting.department,
      url: posting.url,
      content: (posting.content ?? "").slice(0, MAX_DESCRIPTION),
      postedAt: posting.updatedAt,
    }));
  }

  return greenhousePostings(board);
}

export async function scanBoards(): Promise<ScanSummary> {
  const scan = await prisma.jobScan.create({ data: { boards: BOARDS.length } });
  const startedAt = scan.startedAt;
  const cutoff = new Date(startedAt.getTime() - MAX_AGE_DAYS * 86_400_000);

  const results: ScanBoardResult[] = [];
  let closed = 0;

  for (const board of BOARDS) {
    const boardResult: ScanBoardResult = {
      board: board.token,
      source: board.source,
      company: board.company,
      seen: 0,
      created: 0,
      updated: 0,
    };

    try {
      const postings = await rawPostings(board);

      const existing = await prisma.jobPosting.findMany({
        where: { board: board.token },
        select: { id: true, externalId: true, hash: true, yearsMin: true, skills: true, seniority: true },
      });
      const byExternal = new Map(existing.map((row) => [row.externalId, row]));

      const toCreate: Array<{
        source: string;
        board: string;
        externalId: string;
        company: string;
        title: string;
        location: string | null;
        department: string | null;
        url: string;
        description: string;
        skills: string[];
        seniority: string | null;
        yearsMin: number | null;
        remote: boolean;
        postedAt: Date | null;
        hash: string;
        firstSeenAt: Date;
        lastSeenAt: Date;
      }> = [];
      const toTouch: string[] = [];
      const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

      for (const job of postings) {
        const title = job.title.trim().slice(0, 200);
        const description = job.content.slice(0, MAX_DESCRIPTION);
        const hash = hashOf([title, job.location, job.department, description.slice(0, 4000)]);

        const skills = extractSkills(`${title} ${job.department ?? ""} ${description}`, 20);
        const seniority = seniorityOf(`${title} ${description.slice(0, 600)}`);
        const rawYears = requiredYears(`${title} ${description.slice(0, 1200)}`);
        // More than twelve years on a single role is almost always a mis-read
        // (a salary, a headcount); treat it as unstated instead of a gate.
        const yearsMin = rawYears !== null && rawYears <= 12 ? rawYears : null;
        const remote = /\bremote\b|work from home|anywhere/i.test(`${job.location ?? ""} ${title}`);
        const postedAt =
          job.postedAt && !Number.isNaN(Date.parse(job.postedAt)) ? new Date(job.postedAt) : null;

        // A posting dated before the window is not added at all.
        if (postedAt && postedAt < cutoff) continue;

        const known = byExternal.get(job.externalId);
        boardResult.seen += 1;

        if (!known) {
          toCreate.push({
            source: board.source,
            board: board.token,
            externalId: job.externalId,
            company: job.company ?? board.company,
            title,
            location: job.location,
            department: job.department,
            url: job.url,
            description,
            skills,
            seniority,
            yearsMin,
            remote,
            postedAt,
            hash,
            firstSeenAt: startedAt,
            lastSeenAt: startedAt,
          });
          continue;
        }

        // Derived fields can change without the text changing (a vocabulary or
        // parsing fix), so they count as a change too.
        const derivedChanged =
          known.yearsMin !== yearsMin ||
          known.seniority !== seniority ||
          known.skills.length !== skills.length ||
          known.skills.some((skill, index) => skill !== skills[index]);

        if (known.hash !== hash || derivedChanged) {
          toUpdate.push({
            id: known.id,
            data: {
              company: job.company ?? board.company,
              title,
              location: job.location,
              department: job.department,
              url: job.url,
              description,
              skills,
              seniority,
              yearsMin,
              remote,
              postedAt,
              hash,
              lastSeenAt: startedAt,
              closedAt: null,
            },
          });
        } else {
          toTouch.push(known.id);
        }
      }

      if (toCreate.length > 0) {
        await prisma.jobPosting.createMany({ data: toCreate });
        boardResult.created = toCreate.length;
      }
      if (toTouch.length > 0) {
        await prisma.jobPosting.updateMany({
          where: { id: { in: toTouch } },
          data: { lastSeenAt: startedAt, closedAt: null },
        });
      }
      for (const update of toUpdate) {
        await prisma.jobPosting.update({ where: { id: update.id }, data: update.data });
      }
      boardResult.updated = toUpdate.length;

      const unseen = await prisma.jobPosting.updateMany({
        where: { board: board.token, lastSeenAt: { lt: startedAt }, closedAt: null },
        data: { closedAt: new Date() },
      });
      closed += unseen.count;
    } catch (error) {
      boardResult.error = error instanceof Error ? error.message : "unknown error";
    }

    results.push(boardResult);
  }

  // Age sweep: a posting past the window leaves the platform even if the board
  // still lists it, because a month-old role is noise to someone applying now.
  const aged = await prisma.jobPosting.updateMany({
    where: {
      closedAt: null,
      OR: [{ postedAt: { lt: cutoff } }, { postedAt: null, firstSeenAt: { lt: cutoff } }],
    },
    data: { closedAt: new Date() },
  });
  closed += aged.count;

  const endedAt = new Date();
  const touchedErrors = results.filter((result) => result.error);
  await prisma.jobScan.update({
    where: { id: scan.id },
    data: {
      endedAt,
      seen: results.reduce((sum, result) => sum + result.seen, 0),
      created: results.reduce((sum, result) => sum + result.created, 0),
      updated: results.reduce((sum, result) => sum + result.updated, 0),
      closed,
      errors: touchedErrors.map((result) => `${result.board}: ${result.error}`).join("; ").slice(0, 1000),
    },
  });

  return {
    scanId: scan.id,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    boards: results,
    seen: results.reduce((sum, result) => sum + result.seen, 0),
    created: results.reduce((sum, result) => sum + result.created, 0),
    updated: results.reduce((sum, result) => sum + result.updated, 0),
    closed,
    errors: touchedErrors.map((result) => `${result.board}: ${result.error}`),
  };
}

/** The most recent finished scan, for the honest "last looked" line. */
export async function lastScan() {
  return prisma.jobScan.findFirst({
    where: { endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
  });
}
