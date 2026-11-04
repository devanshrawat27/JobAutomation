import "server-only";

import { prisma } from "@/lib/db";
import { BOARDS } from "@/lib/jobs/boards";
import { visiblePostings } from "@/lib/jobs/detail";
import { checkEligibility, parseEligibility, type EligibilityProfile } from "@/lib/jobs/eligibility";
import { lastScan } from "@/lib/jobs/ingest";
import { buildCandidate, entryFriendly, matchPosting, type CandidateModel, type MatchBreakdown } from "@/lib/jobs/match";
import { assessPosting } from "@/lib/jobs/trust";
import { listingWindowWhere } from "@/lib/jobs/window";

/**
 * Everything the signed-in Overview reads, in one server-side pass.
 *
 * Rules the page relies on:
 * - every user-owned query is filtered by the session user id;
 * - postings are shared corpus rows plus the viewer's own private rows;
 * - "new" has one definition (two days), shared with /digest;
 * - nothing external is fetched on render.
 */

export const NEW_MATCH_DAYS = 2;
export const FOLLOW_UP_DAYS = 7;
/** A scan older than this is reported as stale rather than healthy. */
export const SCAN_STALE_MINUTES = 45;

const PROFILE_AREAS = [
  ["contact", "Contact"],
  ["education", "Education"],
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["skills", "Skills"],
  ["preferences", "Job preferences"],
] as const;

export const PIPELINE_STAGES = [
  { key: "prepared", label: "Prepared", statuses: ["PREPARED"], hint: "Documents ready, not sent" },
  { key: "filled", label: "Form filled", statuses: ["FILLED"], hint: "Answers copied, not submitted" },
  { key: "submitted", label: "Submit attempted", statuses: ["SUBMIT_ATTEMPTED"], hint: "You pressed submit" },
  { key: "confirmed", label: "Receipt confirmed", statuses: ["RECEIPT_CONFIRMED"], hint: "The employer confirmed it" },
  { key: "interview", label: "Interview", statuses: ["INTERVIEW"], hint: "Talking to them" },
  { key: "offer", label: "Offer", statuses: ["OFFER"], hint: "An offer on the table" },
  { key: "closed", label: "Closed", statuses: ["REJECTED", "WITHDRAWN"], hint: "Rejected or withdrawn" },
] as const;

export type DashboardMatch = {
  id: string;
  board: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  department: string | null;
  url: string;
  postedAt: Date | null;
  firstSeenAt: Date;
  salaryMin: number | null;
  salaryMax: number | null;
  score: number;
  verdict: MatchBreakdown["verdict"];
  matched: string[];
  missing: string[];
  reasons: string[];
  entry: boolean;
  eligibility: { verdict: string; reasons: string[] } | null;
  trust: { risk: string; flags: Array<{ label: string; detail: string }> };
  saved: boolean;
  tracked: boolean;
};

export type AttentionItem = {
  title: string;
  detail: string;
  href: string;
  action: string;
  tone: "info" | "warn";
};

export type ActivityItem = {
  id: string;
  kind: "application" | "document" | "saved";
  title: string;
  detail: string;
  href: string;
  at: Date;
};

export type DashboardData = {
  candidate: CandidateModel;
  /** First name from the verified profile, or an empty string. */
  displayName: string;
  factsCount: number;
  matches: DashboardMatch[];
  matchPool: number;
  metrics: {
    newMatches: number;
    shortlisted: number;
    inProgress: number;
    followUps: number;
  };
  documentsCount: number;
  pipeline: Array<{ key: string; label: string; hint: string; count: number }>;
  readiness: {
    filled: string[];
    missing: string[];
    formDetailsFilled: number;
    formDetailsMissing: number;
    percent: number;
    headline: string;
  };
  attention: AttentionItem[];
  activity: ActivityItem[];
  scan: {
    at: Date | null;
    stale: boolean;
    errors: string[];
    boardsConfigured: number;
    seen: number;
  };
};

function eligibilityProfileFrom(facts: Array<{ label: string; value: string }>, candidate: CandidateModel): EligibilityProfile {
  const gradeFact = facts.find((fact) => /grade|cgpa|gpa|percentage|marks/i.test(fact.label));
  const gradeText = gradeFact?.value ?? "";
  const cgpaMatch = gradeText.match(/([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*(?:\/\s*([0-9]{1,3}))?/);
  const percentageMatch = gradeText.match(/([0-9]{2}(?:\.[0-9])?)\s*%/);

  return {
    cgpa: cgpaMatch && !percentageMatch ? Number(cgpaMatch[1]) : null,
    cgpaScale: cgpaMatch?.[2] ? Number(cgpaMatch[2]) : cgpaMatch ? 10 : null,
    percentage: percentageMatch ? Number(percentageMatch[1]) : null,
    graduationYear: candidate.graduationYear,
    degree: facts.find((fact) => /degree|discipline|course/i.test(fact.label))?.value ?? null,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = Date.now();
  const newSince = new Date(now - NEW_MATCH_DAYS * 86_400_000);
  const followUpSince = new Date(now - FOLLOW_UP_DAYS * 86_400_000);
  const staleSince = new Date(now - SCAN_STALE_MINUTES * 60_000);

  const [facts, decisions, applications, documents, documentsCount, scan, postings] = await Promise.all([
    prisma.profileFact.findMany({
      where: { userId, status: { in: ["CONFIRMED", "EDITED"] } },
      orderBy: { position: "asc" },
      select: { key: true, groupId: true, label: true, value: true },
    }),
    prisma.jobDecision.findMany({
      where: { userId },
      select: { postingId: true, board: true, title: true, company: true, url: true, status: true, updatedAt: true },
    }),
    prisma.application.findMany({
      where: { userId },
      orderBy: { statusChangedAt: "desc" },
      take: 200,
      select: {
        id: true,
        postingId: true,
        postingTitle: true,
        company: true,
        status: true,
        priority: true,
        statusChangedAt: true,
        createdAt: true,
      },
    }),
    prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, kind: true, postingTitle: true, company: true, createdAt: true, review: true },
    }),
    prisma.document.count({ where: { userId } }),
    lastScan(),
    prisma.jobPosting.findMany({
      where: {
        closedAt: null,
        AND: [visiblePostings(userId), listingWindowWhere(now)],
      },
      orderBy: [{ postedAt: "desc" }, { firstSeenAt: "desc" }],
      take: 800,
      select: {
        id: true,
        source: true,
        board: true,
        externalId: true,
        company: true,
        title: true,
        location: true,
        department: true,
        url: true,
        description: true,
        skills: true,
        seniority: true,
        yearsMin: true,
        salaryMin: true,
        salaryMax: true,
        remote: true,
        postedAt: true,
        firstSeenAt: true,
      },
    }),
  ]);

  const candidate = buildCandidate(
    facts.map((fact) => ({ label: fact.label, value: fact.value, group: fact.groupId })),
  );
  const eligibilityProfile = eligibilityProfileFrom(facts, candidate);
  const dismissed = new Set(decisions.filter((decision) => decision.status === "DISMISSED").map((decision) => decision.postingId));
  const saved = new Set(decisions.filter((decision) => decision.status === "SAVED").map((decision) => decision.postingId));
  const tracked = new Set(applications.map((application) => application.postingId));

  const profileReady = candidate.skills.length > 0 || candidate.roleWords.length > 0 || candidate.years > 0;

  const scored: DashboardMatch[] = profileReady
    ? postings
        .filter((posting) => !dismissed.has(posting.id))
        .filter((posting) => {
          const text = `${posting.company} ${posting.title}`.toLowerCase();
          if (candidate.exclude.some((word) => text.includes(word))) return false;
          const pay = posting.salaryMax ?? posting.salaryMin;
          return !(candidate.salaryFloor !== null && pay !== null && pay < candidate.salaryFloor);
        })
        .map((posting) => {
          const fit = matchPosting(
            {
              source: posting.source,
              title: posting.title,
              department: posting.department,
              location: posting.location,
              description: posting.description,
              skills: posting.skills,
              seniority: posting.seniority,
              yearsMin: posting.yearsMin,
              remote: posting.remote,
              updatedAt: (posting.postedAt ?? posting.firstSeenAt).toISOString(),
            },
            candidate,
          );
          const rules = parseEligibility(posting.description);
          const eligibility = rules.length > 0 ? checkEligibility(rules, eligibilityProfile) : null;
          const trust = assessPosting(posting);

          return {
            id: posting.id,
            board: posting.board,
            externalId: posting.externalId,
            company: posting.company,
            title: posting.title,
            location: posting.location,
            department: posting.department,
            url: posting.url,
            postedAt: posting.postedAt,
            firstSeenAt: posting.firstSeenAt,
            salaryMin: posting.salaryMin,
            salaryMax: posting.salaryMax,
            score: fit.score,
            verdict: fit.verdict,
            matched: fit.matched.slice(0, 4),
            missing: fit.missing.slice(0, 2),
            reasons: fit.reasons,
            entry: entryFriendly(posting),
            eligibility: eligibility ? { verdict: eligibility.verdict, reasons: eligibility.reasons } : null,
            trust: { risk: trust.risk, flags: trust.flags },
            saved: saved.has(posting.id),
            tracked: tracked.has(posting.id),
          };
        })
        .filter((match) => match.score >= 50)
    : [];

  const openPool = scored.filter((match) => !match.tracked);
  const matches = [...openPool].sort((left, right) => right.score - left.score).slice(0, 4);

  const inProgressStatuses = ["PREPARED", "FILLED", "SUBMIT_ATTEMPTED"];
  const inProgress = applications.filter((application) => inProgressStatuses.includes(application.status)).length;
  const followUps = applications.filter(
    (application) =>
      ["FILLED", "SUBMIT_ATTEMPTED"].includes(application.status) && application.statusChangedAt < followUpSince,
  );
  const newMatches = scored.filter((match) => match.firstSeenAt >= newSince && !match.tracked).length;

  const pipeline = PIPELINE_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    hint: stage.hint,
    count: applications.filter((application) => (stage.statuses as readonly string[]).includes(application.status)).length,
  }));

  const filledAreas = PROFILE_AREAS.filter(([id]) => facts.some((fact) => fact.groupId === id)).map(([, label]) => label);
  const missingAreas = PROFILE_AREAS.filter(([id]) => !facts.some((fact) => fact.groupId === id)).map(([, label]) => label);
  const formFacts = facts.filter((fact) => fact.key.startsWith("form."));
  const formDetailsFilled = new Set(formFacts.map((fact) => fact.key)).size;
  // Employer forms ask about a dozen things a resume rarely states.
  const formDetailsMissing = Math.max(0, 12 - formDetailsFilled);
  const readinessPercent = Math.round(
    ((filledAreas.length + Math.min(formDetailsFilled, 12)) / (PROFILE_AREAS.length + 12)) * 100,
  );

  const attention: AttentionItem[] = [];
  if (missingAreas.length > 0) {
    attention.push({
      title: "Finish your profile",
      detail: `Still empty: ${missingAreas.join(", ")}. Those areas are what form answers draw on.`,
      href: "/profile",
      action: "Open profile",
      tone: "info",
    });
  }
  if (formDetailsMissing > 0) {
    attention.push({
      title: `${formDetailsMissing} form ${formDetailsMissing === 1 ? "detail is" : "details are"} unset`,
      detail: "Notice period, work authorization, expected pay and relocation are asked by most employer forms.",
      href: "/profile",
      action: "Add details",
      tone: "info",
    });
  }
  if (followUps.length > 0) {
    attention.push({
      title: `${followUps.length} application${followUps.length === 1 ? "" : "s"} worth a follow-up`,
      detail: `Submitted or filled, with no change for ${FOLLOW_UP_DAYS}+ days.`,
      href: "/applications",
      action: "Open tracker",
      tone: "warn",
    });
  }
  const unchecked = matches.filter((match) => match.eligibility?.verdict === "check").length;
  if (unchecked > 0) {
    attention.push({
      title: `${unchecked} shortlisted role${unchecked === 1 ? "" : "s"} need an eligibility check`,
      detail: "The posting states criteria your profile does not answer — CGPA scale, batch year or degree.",
      href: "/jobs?view=for-you",
      action: "Review roles",
      tone: "warn",
    });
  }
  const unreviewed = documents.find((document) => {
    const review = document.review as { status?: string } | null;
    return review?.status === "unavailable";
  });
  if (unreviewed) {
    attention.push({
      title: "A document has no reviewer pass",
      detail: `“${unreviewed.postingTitle}” was generated while the reviewer was unavailable. Only the number check ran.`,
      href: `/documents/${unreviewed.id}`,
      action: "Read it yourself",
      tone: "warn",
    });
  }
  if (!scan) {
    attention.push({
      title: "No scan has finished yet",
      detail: "Job discovery has not completed once. The list fills after the first scan.",
      href: "/jobs",
      action: "Open jobs",
      tone: "warn",
    });
  }

  const events = await prisma.applicationEvent.findMany({
    where: { application: { userId } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      application: { select: { id: true, postingTitle: true, company: true } },
    },
  });

  const activity: ActivityItem[] = [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      kind: "application" as const,
      title: event.application.postingTitle,
      detail: `${event.application.company} · status ${event.status.replaceAll("_", " ").toLowerCase()}`,
      href: `/applications/${event.application.id}`,
      at: event.createdAt,
    })),
    ...documents.slice(0, 6).map((document) => ({
      id: `document-${document.id}`,
      kind: "document" as const,
      title: document.kind === "RESUME" ? `Tailored resume · ${document.postingTitle}` : `Cover letter · ${document.postingTitle}`,
      detail: document.company,
      href: `/documents/${document.id}`,
      at: document.createdAt,
    })),
    ...decisions
      .filter((decision) => decision.status === "SAVED")
      .slice(0, 6)
      .map((decision) => ({
        id: `decision-${decision.postingId}`,
        kind: "saved" as const,
        title: decision.title,
        detail: `${decision.company} · saved`,
        href: `/jobs/${decision.board}/${encodeURIComponent(decision.postingId.split(":")[2] ?? "")}`,
        at: decision.updatedAt,
      })),
  ]
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, 7);

  const errors = (scan?.errors ?? "")
    .split("; ")
    .filter((line) => line && BOARDS.some((board) => line.startsWith(`${board.token}:`)));

  return {
    candidate,
    displayName: (facts.find((fact) => /full name|^name$/i.test(fact.label))?.value ?? "").trim().split(/\s+/)[0] ?? "",
    factsCount: facts.length,
    matches,
    matchPool: openPool.length,
    metrics: {
      newMatches,
      shortlisted: saved.size,
      inProgress,
      followUps: followUps.length,
    },
    documentsCount,
    pipeline,
    readiness: {
      filled: filledAreas,
      missing: missingAreas,
      formDetailsFilled,
      formDetailsMissing,
      percent: readinessPercent,
      headline:
        filledAreas.length === PROFILE_AREAS.length
          ? "Every profile area has a confirmed fact"
          : `${filledAreas.length} of ${PROFILE_AREAS.length} areas confirmed`,
    },
    attention,
    activity,
    scan: {
      at: scan?.endedAt ?? null,
      stale: !scan?.endedAt || scan.endedAt < staleSince,
      errors,
      boardsConfigured: BOARDS.length,
      seen: scan?.seen ?? 0,
    },
  };
}
