import { randomBytes } from "node:crypto";
import Link from "next/link";

import AppShell from "@/components/app-shell";
import MatchDonut from "@/components/match-donut";

import { addHiringPost } from "@/app/actions/hiring-post";
import { importJob } from "@/app/actions/import-job";
import SavedFilters from "@/components/saved-filters";
import { scanNow, setJobDecision } from "@/app/actions/jobs";
import { BOARDS } from "@/lib/jobs/boards";
import { searchJobs } from "@/lib/jobs";
import { companySlug } from "@/lib/jobs/company";
import { lastScan } from "@/lib/jobs/ingest";
import { visiblePostings } from "@/lib/jobs/detail";
import { listingWindowWhere } from "@/lib/jobs/window";
import { buildCandidate, entryFriendly, matchPosting, roleFamily, seniorityOf } from "@/lib/jobs/match";
import { checkEligibility, parseEligibility, type EligibilityProfile } from "@/lib/jobs/eligibility";
import { parseReach } from "@/lib/jobs/place";
import { formatSalary, medianSalary } from "@/lib/jobs/salary";
import { assessPosting } from "@/lib/jobs/trust";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

type Row = {
  id: string;
  board: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  department: string | null;
  url: string;
  postedAt: string | null;
  firstSeenAt: string | null;
  updatedAt: string | null;
  skills: string[];
  seniority: string | null;
  yearsMin: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  remote: boolean;
  description: string;
};

export const dynamic = "force-dynamic";

type JobsSearchParams = {
  q?: string | string[];
  board?: string | string[];
  view?: string | string[];
  family?: string | string[];
  level?: string | string[];
  where?: string | string[];
  source?: string | string[];
  pay?: string | string[];
  fresh?: string | string[];
  error?: string | string[];
  imported?: string | string[];
};

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** The filter values a candidate can choose from, in the order they are shown. */
const FAMILIES = [
  ["engineering", "Engineering"],
  ["data", "Data & ML"],
  ["design", "Design"],
  ["product", "Product"],
  ["operations", "Operations"],
  ["support", "Support"],
  ["sales", "Sales"],
  ["marketing", "Marketing"],
  ["finance", "Finance"],
  ["hr", "People / HR"],
] as const;

const LEVELS = [
  ["entry", "Internship / entry"],
  ["junior", "0–2 years"],
  ["mid", "2–5 years"],
  ["senior", "Senior / lead"],
] as const;

const PLACES = [
  ["india", "In India"],
  ["remote", "Remote"],
  ["abroad", "Abroad"],
] as const;

const SOURCES = [
  ["direct", "Direct posts"],
  ["ats", "Company boards"],
] as const;

const PAYS = [
  ["3", "₹3L+"],
  ["6", "₹6L+"],
  ["10", "₹10L+"],
  ["20", "₹20L+"],
] as const;

const FRESH = [
  ["24h", "Last 24 hours"],
  ["3d", "Last 3 days"],
  ["7d", "Last 7 days"],
] as const;

function familyOf(row: { title: string; department: string | null; description: string }): string {
  return (
    roleFamily(`${row.title} ${row.department ?? ""}`) ??
    roleFamily(row.description.slice(0, 320)) ??
    "other"
  );
}

function levelOf(row: {
  title: string;
  description: string;
  yearsMin: number | null;
  seniority: string | null;
}): string {
  if (entryFriendly({ title: row.title, description: row.description })) return "entry";
  const level = row.seniority ?? seniorityOf(`${row.title} ${row.description.slice(0, 400)}`);
  if (level === "lead" || level === "senior" || (row.yearsMin ?? 0) >= 5) return "senior";
  if ((row.yearsMin ?? 0) >= 2) return "mid";
  return "junior";
}

function placeOf(row: { title: string; location: string | null; description: string }): string {
  const reach = parseReach(row.location, row.title, row.description);
  if (reach.restricted && !/^india$/i.test(reach.restriction ?? "")) return "abroad";
  if (reach.country && !/india/i.test(reach.country)) return "abroad";
  if (reach.remote) return "remote";
  return "india";
}

const COMMUNITY_BOARDS = new Set(["whoishiring", "pasted", "hiring", "jobopening", "techjobs", "captured"]);

function sourceKindOf(row: { board: string }): string {
  return COMMUNITY_BOARDS.has(row.board) ? "direct" : "ats";
}

function communityLabel(board: string): string | null {
  if (board === "whoishiring") return "Hacker News post";
  if (board === "pasted") return "Added by you";
  if (board === "captured") return "Saved from browser";
  if (board === "jobopening" || board === "hiring" || board === "techjobs") return "Mastodon post";
  return null;
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function updatedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.parse(iso) - Date.now();
  if (Number.isNaN(diff)) return null;

  const days = Math.round(diff / 86_400_000);
  if (Math.abs(days) >= 1) return relative.format(days, "day");

  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) >= 1) return relative.format(hours, "hour");

  return "just now";
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<JobsSearchParams> }) {
  const { q, board, view, family, level, where, source, pay, fresh, error, imported } = await searchParams;
  const query = pick(q).slice(0, 80);
  const boardToken = pick(board);
  const familyFilter = FAMILIES.some(([value]) => value === pick(family)) ? pick(family) : "";
  const levelFilter = LEVELS.some(([value]) => value === pick(level)) ? pick(level) : "";
  const whereFilter = PLACES.some(([value]) => value === pick(where)) ? pick(where) : "";
  const sourceFilter = SOURCES.some(([value]) => value === pick(source)) ? pick(source) : "";
  const payFilter = PAYS.some(([value]) => value === pick(pay)) ? pick(pay) : "";
  const freshFilter = FRESH.some(([value]) => value === pick(fresh)) ? pick(fresh) : "";
  const activeFilters = [familyFilter, levelFilter, whereFilter, sourceFilter, payFilter, freshFilter].filter(Boolean).length;
  const errorText = pick(error);
  const importedRef = pick(imported);
  const requestedView = pick(view);
  const selectedView = ["for-you", "fresher", "all", "saved", "dismissed"].includes(requestedView) ? requestedView : "";

  const session = await getCurrentSession();
  const [decisions, facts] = session?.user
    ? await Promise.all([
        prisma.jobDecision.findMany({
          where: { userId: session.user.id },
          select: { postingId: true, status: true },
        }),
        prisma.profileFact.findMany({
          where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
          select: { label: true, value: true, groupId: true },
        }),
      ])
    : [[], []];

  const candidate = buildCandidate(
    facts.map((fact) => ({ label: fact.label, value: fact.value, group: fact.groupId })),
  );
  const forYouAvailable = candidate.skills.length > 0 || candidate.roleWords.length > 0 || candidate.years > 0;
  // Without a profile nobody is a fresher; the empty candidate would otherwise
  // look like a 0-year student and every view would filter itself away.
  const isFresher = forYouAvailable && (candidate.student || candidate.seniority === "fresher");
  const requestedButUnavailable = (selectedView === "fresher" && !isFresher) || (selectedView === "for-you" && !forYouAvailable);
  const effectiveView = requestedButUnavailable ? "all" : selectedView || (forYouAvailable ? "for-you" : "");
  const byPosting = new Map(decisions.map((decision) => [decision.postingId, decision.status]));
  const savedCount = decisions.filter((decision) => decision.status === "SAVED").length;
  const dismissedCount = decisions.filter((decision) => decision.status === "DISMISSED").length;

  const stored = await prisma.jobPosting.findMany({
    where: {
      closedAt: null,
      AND: [
        // Private rows belong to the account that supplied them; public board
        // rows are shared. Age is applied here, not written as closure.
        visiblePostings(session?.user?.id ?? null),
        listingWindowWhere(),
        ...(boardToken ? [{ board: boardToken }] : []),
        ...(query
          ? [
              {
                OR: [
                  { title: { contains: query, mode: "insensitive" as const } },
                  { company: { contains: query, mode: "insensitive" as const } },
                  { location: { contains: query, mode: "insensitive" as const } },
                  { department: { contains: query, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ postedAt: "desc" }, { firstSeenAt: "desc" }],
    // Match over the whole open corpus; the list itself is capped later.
    take: 4000,
    select: {
      id: true,
      board: true,
      externalId: true,
      company: true,
      title: true,
      location: true,
      department: true,
      url: true,
      postedAt: true,
      firstSeenAt: true,
      updatedAt: true,
      skills: true,
      seniority: true,
      yearsMin: true,
      salaryMin: true,
      salaryMax: true,
      remote: true,
      description: true,
    },
  });

  // Before the first scan the store is empty; read the boards live once so the
  // page still works, and say so instead of pretending it is a stored corpus.
  const liveFallback = stored.length === 0 ? await searchJobs({ query, boardToken }) : null;
  const rows: Row[] =
    stored.length > 0
      ? stored.map((row) => ({
          ...row,
          postedAt: row.postedAt ? row.postedAt.toISOString() : null,
          firstSeenAt: row.firstSeenAt ? row.firstSeenAt.toISOString() : null,
          updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
        }))
      : (liveFallback?.postings ?? []).map((posting) => ({
          id: posting.id,
          board: posting.board,
          externalId: posting.externalId,
          company: posting.company,
          title: posting.title,
          location: posting.location,
          department: posting.department,
          url: posting.url,
          postedAt: posting.updatedAt,
          firstSeenAt: null,
          updatedAt: posting.updatedAt,
          skills: [],
          seniority: null,
          yearsMin: null,
          salaryMin: null,
          salaryMax: null,
          remote: /remote/i.test(posting.location ?? ""),
          description: "",
        }));

  const originOf = (posting: Row) =>
    posting.board === "whoishiring"
      ? "hn"
      : posting.board === "pasted"
        ? "manual"
        : posting.board === "captured"
          ? "captured"
          : posting.board === "hiring" || posting.board === "jobopening" || posting.board === "techjobs"
          ? "mastodon"
          : "greenhouse";
  let captureToken: string | null = null;
  if (session?.user) {
    const record = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { captureToken: true },
    });
    captureToken = record?.captureToken ?? null;
    if (!captureToken) {
      captureToken = randomBytes(18).toString("hex");
      await prisma.user.update({ where: { id: session.user.id }, data: { captureToken } });
    }
  }

  // The numbers an Indian posting actually gates on.
  const gradeFact = facts.find((fact) => /grade|cgpa|gpa|percentage|marks/i.test(fact.label));
  const gradeText = gradeFact?.value ?? "";
  const cgpaMatch = gradeText.match(/([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*(?:\/\s*([0-9]{1,3}))?/);
  const percentageMatch = gradeText.match(/([0-9]{2}(?:\.[0-9])?)\s*%/);
  const eligibilityProfile: EligibilityProfile = {
    cgpa: cgpaMatch && !percentageMatch ? Number(cgpaMatch[1]) : null,
    cgpaScale: cgpaMatch?.[2] ? Number(cgpaMatch[2]) : cgpaMatch ? 10 : null,
    percentage: percentageMatch ? Number(percentageMatch[1]) : null,
    graduationYear: candidate.graduationYear,
    degree: facts.find((fact) => /degree|discipline|course/i.test(fact.label))?.value ?? null,
  };

  const scan = await lastScan();
  const scanErrors = (scan?.errors ?? "")
    .split("; ")
    .filter((line) => line && BOARDS.some((entry) => line.startsWith(`${entry.token}:`)))
    .join("; ");
  const allOpen = await prisma.jobPosting.count({
    where: {
      closedAt: null,
      AND: [visiblePostings(session?.user?.id ?? null), listingWindowWhere()],
    },
  });

  const scored = rows.map((posting) => ({
    posting,
    fit: forYouAvailable ? matchPosting({ ...posting, source: originOf(posting) }, candidate) : null,
  }));

  // The same role often appears on more than one source. Keep the version with
  // the best score and remember how many other boards carried it.
  const dedupe = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const unique = new Map<string, { posting: Row; fit: (typeof scored)[number]["fit"]; alternates: number }>();
  for (const entry of scored) {
    const key = `${dedupe(entry.posting.company)}|${dedupe(entry.posting.title)}`;
    const known = unique.get(key);
    if (!known) {
      unique.set(key, { ...entry, alternates: 0 });
      continue;
    }
    const better =
      (entry.fit?.score ?? 0) > (known.fit?.score ?? 0)
        ? { ...entry, alternates: known.alternates + 1 }
        : { ...known, alternates: known.alternates + 1 };
    unique.set(key, better);
  }
  const candidates = [...unique.values()];

  // The listing window is relative to this request; the clock is the subject.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const freshCutoff =
    freshFilter === "24h"
      ? nowMs - 86_400_000
      : freshFilter === "3d"
        ? nowMs - 3 * 86_400_000
        : freshFilter === "7d"
          ? nowMs - 7 * 86_400_000
          : null;

  const filtered = candidates.filter(({ posting, fit }) => {
    if (familyFilter && familyOf(posting) !== familyFilter) return false;
    if (levelFilter && levelOf(posting) !== levelFilter) return false;
    if (whereFilter && placeOf(posting) !== whereFilter) return false;
    if (sourceFilter && sourceKindOf(posting) !== sourceFilter) return false;
    if (payFilter && (posting.salaryMax ?? posting.salaryMin ?? 0) < Number(payFilter)) return false;
    if (freshFilter) {
      const stamp = Date.parse(posting.postedAt ?? posting.firstSeenAt ?? "");
      if (!Number.isFinite(stamp) || stamp < (freshCutoff ?? 0)) return false;
    }

    const decision = byPosting.get(posting.id);
    if (effectiveView === "saved") return decision === "SAVED";
    if (effectiveView === "dismissed") return decision === "DISMISSED";
    if (decision === "DISMISSED") return false;
    if (effectiveView === "for-you") {
      return (fit?.score ?? 0) >= 50 && fit?.verdict !== "possible" && fit?.verdict !== "weak";
    }
    if (effectiveView === "fresher") {
      return entryFriendly(posting) && (fit?.score ?? 0) >= 50;
    }
    return true;
  });

  const ordered =
    effectiveView === "for-you" || effectiveView === "fresher"
      ? [...filtered].sort((left, right) => {
          if ((right.fit?.score ?? 0) !== (left.fit?.score ?? 0)) {
            return (right.fit?.score ?? 0) - (left.fit?.score ?? 0);
          }
          const leftTime = left.posting.postedAt ? Date.parse(left.posting.postedAt) : 0;
          const rightTime = right.posting.postedAt ? Date.parse(right.posting.postedAt) : 0;
          return rightTime - leftTime;
        })
      : filtered;

  const strongCount = candidates.filter((entry) => entry.fit?.verdict === "strong").length;
  const fresherCount = candidates.filter(
    (entry) => entryFriendly(entry.posting) && (entry.fit?.score ?? 0) >= 50,
  ).length;
  const viewNote =
    effectiveView === "fresher"
      ? "Only internships, graduate programmes and 0–2 year roles where your profile covers what the posting names."
      : effectiveView === "for-you"
        ? "A shortlist, not a feed: only roles where your profile covers the skills the posting names, ranked by title, years asked, location and freshness."
        : effectiveView === "saved"
          ? "Postings you kept. Nothing here has been applied to."
          : effectiveView === "dismissed"
            ? "Postings you hid. Undo puts one back."
            : "Everything from the last 14 days, newest first. Older postings stay stored but leave the list — they are not marked closed.";
  const visible = ordered.slice(0, 60).map((entry) => {
    const rules = parseEligibility(entry.posting.description);
    return {
      ...entry,
      eligible: forYouAvailable && rules.length > 0 ? checkEligibility(rules, eligibilityProfile) : null,
      trust: assessPosting(entry.posting),
    };
  });
  const medianPay = medianSalary(
    rows
      .map((row) => row.salaryMax ?? row.salaryMin)
      .filter((value): value is number => value !== null),
  );
  const activeBoards = BOARDS.filter((board) => (scan?.errors ?? "").indexOf(board.token) === -1);

  return (
    <AppShell active="jobs">
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          {session?.user ? <Link href="/profile">Your profile ↗</Link> : <Link href="/sign-in">Sign in</Link>}
        </span>
      </header>

      <section aria-labelledby="jobs-title" className="jobs-shell">
        <div className="jobs-hero">
          <div className="jobs-hero-copy">
            <p className="section-kicker">Job discovery</p>
            <h1 id="jobs-title">{effectiveView === "fresher" ? "Fresher roles" : "Jobs"}</h1>
            <p className="onboarding-intro">
              Every posting is published by the employer on their own job board, and every card says why it matched you.
              Saving or dismissing only changes what you see here — nothing is ever applied to.
            </p>
          </div>

          <dl className="jobs-stats">
            <div>
              <dt>Live postings (14 days)</dt>
              <dd>{allOpen}</dd>
            </div>
            <div>
              <dt>Employer boards</dt>
              <dd>{activeBoards.length}</dd>
            </div>
            <div>
              <dt>Last scan</dt>
              <dd>{scan?.endedAt ? updatedLabel(scan.endedAt.toISOString()) : "not yet"}</dd>
            </div>
            <div>
              <dt>Strong matches</dt>
              <dd>{forYouAvailable ? strongCount : "—"}</dd>
            </div>
            <div>
              <dt>Median pay stated</dt>
              <dd>{medianPay !== null ? `₹${medianPay} LPA` : "—"}</dd>
            </div>
          </dl>
        </div>

        <form action={importJob} className="jobs-import" id="import">
          <label className="jobs-field jobs-import-field">
            <span>Paste a job link</span>
            <input
              name="url"
              placeholder="jobs.lever.co/… · boards.greenhouse.io/… · jobs.ashbyhq.com/… · apply.workable.com/…"
              required
              type="url"
            />
          </label>
          <button className="onboarding-submit jobs-import-submit" type="submit">
            Import this job <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="jobs-import-hint">
          Greenhouse, Lever, Ashby and Workable links open in one click. LinkedIn and X cannot be read automatically — use
          the extension or paste the post below.
        </p>

        {importedRef ? (
          <p className="doc-banner is-ok" role="status">
            Imported {decodeURIComponent(importedRef)}. It is scored like any other posting.
          </p>
        ) : null}
        {errorText.startsWith("import") ? (
          <p className="auth-error" role="alert">
            {errorText === "import-unsupported"
              ? "That link is not a Greenhouse, Lever, Ashby or Workable posting. Paste the post text instead."
              : errorText === "import-not-found"
                ? "The posting was not found on that board — it may have been closed."
                : errorText === "import-format"
                  ? "That does not look like a full link. Paste the whole URL."
                  : "The board did not answer. Try again, or paste the post text below."}
          </p>
        ) : null}

        <form className="jobs-filters" method="get">
          <input name="view" type="hidden" value={effectiveView} />
          <label className="jobs-field">
            <span>Search</span>
            <input defaultValue={query} name="q" placeholder="title, team or city" type="search" />
          </label>
          <label className="jobs-field">
            <span>Board</span>
            <select defaultValue={boardToken} name="board">
              <option value="">All boards</option>
              {BOARDS.map((option) => (
                <option key={option.token} value={option.token}>{option.company}</option>
              ))}
            </select>
          </label>
          <button className="onboarding-submit jobs-submit" type="submit">
            Search <span aria-hidden="true">→</span>
          </button>
        </form>

        <form className="jobs-filters jobs-filters--chips" method="get">
          <input name="view" type="hidden" value={effectiveView} />
          {query ? <input name="q" type="hidden" value={query} /> : null}
          {boardToken ? <input name="board" type="hidden" value={boardToken} /> : null}
          <label className="jobs-field">
            <span>Role type</span>
            <select defaultValue={familyFilter} name="family">
              <option value="">Any role</option>
              {FAMILIES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="jobs-field">
            <span>Experience</span>
            <select defaultValue={levelFilter} name="level">
              <option value="">Any level</option>
              {LEVELS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="jobs-field">
            <span>Where</span>
            <select defaultValue={whereFilter} name="where">
              <option value="">Anywhere</option>
              {PLACES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="jobs-field">
            <span>Source</span>
            <select defaultValue={sourceFilter} name="source">
              <option value="">Any source</option>
              {SOURCES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="jobs-field">
            <span>Pay</span>
            <select defaultValue={payFilter} name="pay">
              <option value="">Any pay</option>
              {PAYS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="jobs-field">
            <span>Posted</span>
            <select defaultValue={freshFilter} name="fresh">
              <option value="">Any time</option>
              {FRESH.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button className="jobs-filter-apply" type="submit">Apply filters</button>
          {activeFilters > 0 ? (
            <Link className="jobs-filter-clear" href={`/jobs?view=${effectiveView}`}>
              Clear {activeFilters}
            </Link>
          ) : null}
        </form>

        <SavedFilters />

        {captureToken ? (
          <details className="jobs-paste">
            <summary>Save the job you are looking at (browser extension)</summary>
            <p>
              LinkedIn and X refuse automated reads, so the extension saves what is already open in your own session: open
              a posting, click the extension, press <strong>Save this job</strong>. Your personal token is below — paste it
              into the extension once.
            </p>
            <p className="jobs-token">
              <code>{captureToken}</code>
            </p>
          </details>
        ) : null}

        <details className="jobs-paste">
          <summary>Add a hiring post you found (LinkedIn, X, Reddit)</summary>
          <p>
            Those platforms block automated reads, so paste the post here instead. It joins the same list, the same score
            and the same cards — marked <strong>direct post</strong>.
          </p>
          <form action={addHiringPost} className="jobs-paste-form">
            <label className="jobs-field">
              <span>Link to the post</span>
              <input name="url" placeholder="https://x.com/… or https://www.linkedin.com/posts/…" required type="url" />
            </label>
            <label className="jobs-field">
              <span>Company (optional)</span>
              <input name="company" placeholder="Acme" type="text" />
            </label>
            <label className="jobs-field jobs-field--wide">
              <span>Post text</span>
              <textarea
                name="text"
                placeholder="Paste the whole post — role, location, requirements, how to apply."
                required
                rows={5}
              />
            </label>
            <button className="onboarding-submit" type="submit">
              Add to my jobs <span aria-hidden="true">→</span>
            </button>
          </form>
        </details>

        <div className="jobs-views">
          <nav aria-label="Job views" className="jobs-tabs">
            {forYouAvailable ? (
              <Link className={effectiveView === "for-you" ? "is-active" : ""} href="/jobs?view=for-you">
                For you
              </Link>
            ) : null}
            {isFresher && forYouAvailable ? (
              <Link className={effectiveView === "fresher" ? "is-active" : ""} href="/jobs?view=fresher">
                Fresher <span>{fresherCount}</span>
              </Link>
            ) : null}
            <Link className={effectiveView === "all" || effectiveView === "" ? "is-active" : ""} href="/jobs?view=all">
              All <span>{allOpen}</span>
            </Link>
            <Link className={effectiveView === "saved" ? "is-active" : ""} href="/jobs?view=saved">
              Saved <span>{savedCount}</span>
            </Link>
            <Link className={effectiveView === "dismissed" ? "is-active" : ""} href="/jobs?view=dismissed">
              Dismissed <span>{dismissedCount}</span>
            </Link>
          </nav>

          <form action={scanNow} className="jobs-scan">
            <button className="jobs-scan-btn" type="submit">
              Scan boards now
            </button>
          </form>
        </div>

        <p className="jobs-view-note">{viewNote}</p>

        {forYouAvailable ? (
          <p className="jobs-read">
            <span>Read from your profile</span>
            {isFresher ? (
              <>
                <b>fresher</b>
                {candidate.graduationYear ? <span> · class of {candidate.graduationYear}</span> : null}
              </>
            ) : (
              <b>{candidate.seniority}</b>
            )}
            <span> · {candidate.years} years from your dates · {candidate.skills.length} skills · {candidate.family ?? "no role family"}</span>
          </p>
        ) : (
          <div className="jobs-gate">
            <div>
              <h2>Sign in to see jobs matched to your resume.</h2>
              <p>
                One profile, read from your resume and confirmed by you. Then every card here shows the skills it matches
                and the ones it does not.
              </p>
            </div>
            <div className="jobs-gate-actions">
              <Link className="onboarding-submit" href="/onboarding/resume?path=new-grad">
                Add your resume <span aria-hidden="true">→</span>
              </Link>
              <Link className="intake-secondary" href="/sign-in?next=%2Fjobs">
                Sign in
              </Link>
            </div>
          </div>
        )}

        {error === "decision" ? (
          <p className="auth-error" role="alert">That decision could not be saved. Try again.</p>
        ) : null}
        {error === "scan-wait" ? (
          <p className="auth-error" role="alert">A scan was started moments ago. Give it two minutes before asking again.</p>
        ) : null}
        {error === "scan-busy" ? (
          <p className="auth-error" role="alert">A scan is already running. The list will update when it finishes.</p>
        ) : null}
        {scanErrors ? <p className="jobs-scan-error">Some boards failed: {scanErrors}</p> : null}

        {ordered.length === 0 && (forYouAvailable || effectiveView !== "fresher") ? (
          <div className="jobs-empty">
            <h2>
              {effectiveView === "fresher"
                ? "No fresher roles on these boards right now."
                : effectiveView === "saved"
                  ? "Nothing saved yet."
                  : effectiveView === "dismissed"
                    ? "Nothing dismissed."
                    : "No postings matched that search."}
            </h2>
            <p>
              {effectiveView === "fresher"
                ? "The scanner runs every 15 minutes. Check All for everything stored, or widen the board filter."
                : effectiveView === "saved"
                  ? "Use Save on a posting to keep it here."
                  : effectiveView === "dismissed"
                    ? "Dismiss a posting to hide it from the lists."
                    : "Try a shorter search, or clear the board filter."}
            </p>
            <Link className="intake-secondary" href="/jobs?view=all">
              Show all postings
            </Link>
          </div>
        ) : (
          <ul className="jobs-list">
            {visible.map(({ posting, fit, alternates, eligible, trust }) => {
              const decision = byPosting.get(posting.id);
              const entry = entryFriendly(posting);
              return (
                <li className={`job-card${fit ? ` is-${fit.verdict}` : ""}`} key={posting.id}>
                  <div className="job-card-head">
                    <div className="job-card-title">
                      <h2>
                        <Link href={`/jobs/${posting.board}/${posting.externalId}`}>{posting.title}</Link>
                      </h2>
                      <p className="job-card-meta">
                        <Link className="job-company" href={`/company/${companySlug(posting.company)}`}>
                          {posting.company}
                        </Link>
                        {posting.location ? <><span aria-hidden="true">·</span><span>{posting.location}</span></> : null}
                        {posting.department ? <><span aria-hidden="true">·</span><span>{posting.department}</span></> : null}
                      </p>
                      <p className="job-tags">
                        {entry ? <span className="job-tag is-entry">Internship / entry level</span> : null}
                        {posting.remote || /remote/i.test(posting.location ?? "") ? <span className="job-tag">Remote</span> : null}
                        {posting.yearsMin ? <span className="job-tag">{posting.yearsMin}+ years</span> : null}
                        {formatSalary(posting.salaryMin, posting.salaryMax) ? (
                          <span className="job-tag is-pay">{formatSalary(posting.salaryMin, posting.salaryMax)}</span>
                        ) : null}
                        {posting.seniority && !(entry && posting.seniority === "intern") ? (
                          <span className="job-tag">{posting.seniority}</span>
                        ) : null}
                        {eligible && eligible.verdict === "not-eligible" ? (
                          <span className="job-tag is-warn">Not eligible: {eligible.reasons[0]?.slice(0, 48)}</span>
                        ) : null}
                        {trust.risk === "high" ? <span className="job-tag is-danger">Check before applying</span> : null}
                        {communityLabel(posting.board) ? (
                          <span className="job-tag is-direct">{communityLabel(posting.board)}</span>
                        ) : null}
                        {alternates > 0 ? <span className="job-tag">+{alternates} more board{alternates === 1 ? "" : "s"}</span> : null}
                      </p>
                    </div>
                    {fit ? (
                      <MatchDonut score={fit.score} verdict={fit.verdict} size={64} />
                    ) : null}
                  </div>

                  {fit ? (
                    <div className="job-match-body">
                      {fit.matched.length > 0 || fit.missing.length > 0 ? (
                        <div className="job-chips">
                          {fit.matched.slice(0, 5).map((skill) => (
                            <span className="job-chip" key={skill}>
                              <span aria-hidden="true">✓</span> {skill}
                            </span>
                          ))}
                          {fit.missing.slice(0, 3).map((skill) => (
                            <span className="job-chip is-missing" key={skill}>
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {fit.reasons.length > 0 ? <p className="job-why">{fit.reasons.slice(0, 2).join(" · ")}</p> : null}
                      <details className="job-breakdown">
                        <summary>Why {fit.score}?</summary>
                        <ul>
                          {[
                            ["Named skills", fit.parts.skills, 45],
                            ["Title match", fit.parts.title, 20],
                            ["Experience asked", fit.parts.seniority, 15],
                            ["Location", fit.parts.location, 10],
                            ["Freshness", fit.parts.freshness, 5],
                          ].map(([label, value, max]) => (
                            <li key={String(label)}>
                              <span>{label}</span>
                              <i>
                                <b style={{ width: `${Math.round((Number(value) / Number(max)) * 100)}%` }} />
                              </i>
                              <em>
                                {value}/{max}
                              </em>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  ) : null}

                  <div className="job-card-foot">
                    <span className="job-updated">
                      {communityLabel(posting.board) ? (
                        <span className="job-trust">Community post · verify the employer before applying</span>
                      ) : updatedLabel(posting.postedAt) ? (
                        `Posted ${updatedLabel(posting.postedAt)}`
                      ) : (
                        ""
                      )}
                    </span>
                    <div className="job-card-actions">
                      {session?.user ? (
                        <form action={setJobDecision} className="job-decision">
                          <input name="postingId" type="hidden" value={posting.id} />
                          <input name="board" type="hidden" value={posting.board} />
                          <input name="title" type="hidden" value={posting.title} />
                          <input name="company" type="hidden" value={posting.company} />
                          <input name="location" type="hidden" value={posting.location ?? ""} />
                          <input name="url" type="hidden" value={posting.url} />
                          <button
                            aria-pressed={decision === "SAVED"}
                            className={`job-action${decision === "SAVED" ? " is-saved" : ""}`}
                            name="decision"
                            type="submit"
                            value="saved"
                          >
                            {decision === "SAVED" ? "Saved" : "Save"}
                          </button>
                          <button
                            aria-pressed={decision === "DISMISSED"}
                            className={`job-action${decision === "DISMISSED" ? " is-dismissed" : ""}`}
                            name="decision"
                            type="submit"
                            value="dismissed"
                          >
                            Dismiss
                          </button>
                          {decision ? (
                            <button className="job-action" name="decision" type="submit" value="clear">
                              Undo
                            </button>
                          ) : null}
                        </form>
                      ) : null}
                      <a className="job-link" href={posting.url} rel="noreferrer noopener" target="_blank">
                        View posting <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {ordered.length > visible.length ? (
          <p className="jobs-note">
            Showing {visible.length} of {ordered.length}. Narrow the search to see the rest.
          </p>
        ) : null}

        <p className="jobs-note">
          {effectiveView === "for-you" || effectiveView === "fresher"
            ? "Each score is built from five things you can check: the skills the posting names (45), the title against your roles (20), the years it asks for versus your dated experience (15), location (10) and freshness (5). Open a posting for the requirement-level comparison."
            : "Discovery only. There is no auto-apply: opening a posting takes you to the employer’s own application form."}
        </p>
      </section>

    </main>
    </AppShell>
  );
}
