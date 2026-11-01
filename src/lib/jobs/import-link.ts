import "server-only";

import { htmlToText } from "@/lib/jobs/html";
import { seniorityOf } from "@/lib/jobs/match";
import { extractSkills } from "@/lib/jobs/skills";
import type { JobSourceId } from "@/lib/jobs/types";
import { requiredYears } from "@/lib/match/experience";

/**
 * Paste a job link, get the posting.
 *
 * Employers publish these through their ATS, and the four big ones answer
 * without a key from the same public endpoints their own careers pages call.
 * The link is parsed, the posting fetched, and the result stored exactly like a
 * scanned one — so it lands in the same list with the same score.
 */

export type ImportedJob = {
  source: JobSourceId;
  board: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  department: string | null;
  url: string;
  content: string;
  postedAt: Date | null;
  skills: string[];
  seniority: string | null;
  yearsMin: number | null;
  remote: boolean;
};

export type ImportResult =
  | { ok: true; job: ImportedJob }
  | { ok: false; reason: "unsupported" | "not-found" | "fetch-failed"; detail?: string };

const UA = "jobautomation/0.1 (import a link the candidate pasted)";
const TIMEOUT = 15_000;

type Parsed = { ats: "greenhouse" | "lever" | "ashby" | "workable"; token: string; id: string };

/** Recognise the four ATS shapes from the URL alone. */
export function parseJobUrl(raw: string): Parsed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // boards.greenhouse.io/<token>/jobs/<id>  ·  job-boards.greenhouse.io/<token>/jobs/<id>
  if (host.endsWith("greenhouse.io")) {
    const token = parts[0];
    const jobIndex = parts.indexOf("jobs");
    const id = jobIndex >= 0 ? parts[jobIndex + 1] : undefined;
    if (token && id) return { ats: "greenhouse", token, id };
    return null;
  }

  // jobs.lever.co/<token>/<uuid>
  if (host === "jobs.lever.co") {
    const [token, id] = parts;
    if (token && id) return { ats: "lever", token, id };
    return null;
  }

  // jobs.ashbyhq.com/<org>/<uuid>
  if (host === "jobs.ashbyhq.com") {
    const [token, id] = parts;
    if (token && id) return { ats: "ashby", token, id };
    return null;
  }

  // apply.workable.com/<token>/j/<shortcode>  ·  <token>.workable.com/j/<shortcode>
  if (host.endsWith("workable.com")) {
    const subdomain = host.endsWith(".workable.com") && host !== "apply.workable.com" ? host.split(".")[0] : null;
    const token = subdomain ?? parts[0];
    const jIndex = parts.indexOf("j");
    const id = jIndex >= 0 ? parts[jIndex + 1] : undefined;
    if (token && id) return { ats: "workable", token, id };
  }

  return null;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (response.status === 404) throw new Error("not-found");
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.json();
}

function tidy(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function finish(partial: {
  source: JobSourceId;
  board: string;
  externalId: string;
  title: string;
  company: string;
  location: string | null;
  department: string | null;
  url: string;
  content: string;
  postedAt: string | null;
}): ImportedJob {
  const description = partial.content.slice(0, 12_000);
  return {
    ...partial,
    content: description,
    postedAt: partial.postedAt && !Number.isNaN(Date.parse(partial.postedAt)) ? new Date(partial.postedAt) : null,
    skills: extractSkills(`${partial.title} ${partial.department ?? ""} ${description}`, 20),
    seniority: seniorityOf(`${partial.title} ${description.slice(0, 600)}`),
    yearsMin: requiredYears(`${partial.title} ${description.slice(0, 1200)}`),
    remote: /\bremote\b|work from home|anywhere/i.test(`${partial.location ?? ""} ${partial.title}`),
  };
}

export async function importJobLink(raw: string): Promise<ImportResult> {
  const parsed = parseJobUrl(raw);
  if (!parsed) return { ok: false, reason: "unsupported" };

  try {
    if (parsed.ats === "greenhouse") {
      const data = (await getJson(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(parsed.token)}/jobs/${encodeURIComponent(parsed.id)}`,
      )) as {
        title?: string;
        absolute_url?: string;
        content?: string;
        updated_at?: string | null;
        company_name?: string | null;
        location?: { name?: string | null } | null;
        departments?: Array<{ name?: string }> | null;
      };

      return {
        ok: true,
        job: finish({
          source: "greenhouse",
          board: parsed.token,
          externalId: parsed.id,
          title: tidy(data.title, 200) ?? "Untitled role",
          company: tidy(data.company_name, 120) ?? parsed.token,
          location: tidy(data.location?.name, 120),
          department: tidy(data.departments?.[0]?.name, 120),
          url: tidy(data.absolute_url, 2000) ?? raw,
          content: data.content ? htmlToText(data.content) : "",
          postedAt: data.updated_at ?? null,
        }),
      };
    }

    if (parsed.ats === "lever") {
      const data = (await getJson(
        `https://api.lever.co/v0/postings/${encodeURIComponent(parsed.token)}/${encodeURIComponent(parsed.id)}?mode=json`,
      )) as {
        text?: string;
        hostedUrl?: string;
        createdAt?: number;
        descriptionPlain?: string;
        categories?: { location?: string; team?: string; department?: string; allLocations?: string[] };
        lists?: Array<{ text?: string; content?: string }>;
      };

      const content = [
        data.descriptionPlain ?? "",
        ...(data.lists ?? []).map((list) => `${list.text ?? ""}\n${htmlToText(list.content ?? "")}`),
      ]
        .filter(Boolean)
        .join("\n\n");

      return {
        ok: true,
        job: finish({
          source: "lever",
          board: parsed.token,
          externalId: parsed.id,
          title: tidy(data.text, 200) ?? "Untitled role",
          company: parsed.token,
          location: tidy(data.categories?.allLocations?.join(" / ") || data.categories?.location, 120),
          department: tidy(data.categories?.team ?? data.categories?.department, 120),
          url: tidy(data.hostedUrl, 2000) ?? raw,
          content,
          postedAt: data.createdAt ? new Date(data.createdAt).toISOString() : null,
        }),
      };
    }

    if (parsed.ats === "ashby") {
      const data = (await getJson(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(parsed.token)}?includeCompensation=true`,
      )) as {
        jobs?: Array<{
          id?: string;
          title?: string;
          location?: string | null;
          department?: string | null;
          descriptionHtml?: string | null;
          descriptionPlain?: string | null;
          publishedAt?: string | null;
          jobUrl?: string | null;
          applyUrl?: string | null;
        }>;
      };

      const job = (data.jobs ?? []).find((entry) => entry.id === parsed.id);
      if (!job) return { ok: false, reason: "not-found" };

      return {
        ok: true,
        job: finish({
          source: "ashby",
          board: parsed.token,
          externalId: parsed.id,
          title: tidy(job.title, 200) ?? "Untitled role",
          company: parsed.token,
          location: tidy(job.location, 120),
          department: tidy(job.department, 120),
          url: tidy(job.jobUrl ?? job.applyUrl, 2000) ?? raw,
          content: job.descriptionPlain ?? (job.descriptionHtml ? htmlToText(job.descriptionHtml) : ""),
          postedAt: job.publishedAt ?? null,
        }),
      };
    }

    // Workable: the widget endpoint lists the board, so find the shortcode in it.
    const data = (await getJson(
      `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(parsed.token)}?details=true`,
    )) as {
      jobs?: Array<{
        shortcode?: string;
        title?: string;
        city?: string | null;
        country?: string | null;
        department?: string | null;
        description?: string | null;
        url?: string | null;
        published_on?: string | null;
        telecommuting?: boolean;
      }>;
    };

    const job = (data.jobs ?? []).find((entry) => entry.shortcode === parsed.id);
    if (!job) return { ok: false, reason: "not-found" };

    const place = [job.city, job.country].filter(Boolean).join(", ") || (job.telecommuting ? "Remote" : null);

    return {
      ok: true,
      job: finish({
        source: "workable",
        board: parsed.token,
        externalId: parsed.id,
        title: tidy(job.title, 200) ?? "Untitled role",
        company: parsed.token,
        location: place ? place.slice(0, 120) : null,
        department: tidy(job.department, 120),
        url: tidy(job.url, 2000) ?? raw,
        content: job.description ? htmlToText(job.description) : "",
        postedAt: job.published_on ?? null,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return {
      ok: false,
      reason: message === "not-found" ? "not-found" : "fetch-failed",
      detail: message,
    };
  }
}
