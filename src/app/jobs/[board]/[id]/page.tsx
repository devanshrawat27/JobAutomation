import Link from "next/link";
import { notFound } from "next/navigation";

import CopyText from "@/components/copy-text";
import { prisma } from "@/lib/db";
import { checkEligibility, parseEligibility } from "@/lib/jobs/eligibility";
import { getJobDetail, type ResolvedJob } from "@/lib/jobs/detail";
import { assessPosting } from "@/lib/jobs/trust";
import { buildCandidate } from "@/lib/jobs/match";
import { buildReferralKit } from "@/lib/referrals";
import { formatSalary } from "@/lib/jobs/salary";
import { matchJob } from "@/lib/match";
import { statusLabels, type FactForMatch, type RequirementStatus } from "@/lib/match/types";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

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

const statusOrder: RequirementStatus[] = ["match", "partial", "gap", "unknown"];

/** Who published this posting, said plainly. */
const SOURCE_LABEL: Record<string, string> = {
  greenhouse: "employer board",
  lever: "employer board",
  ashby: "employer board",
  smartrecruiters: "employer board",
  workable: "employer board",
  hn: "Hacker News post",
  mastodon: "Mastodon post",
  manual: "post you added",
  captured: "saved from your browser",
};

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ board: string; id: string }>;
}) {
  const { board: boardToken, id } = await params;
  const session = await getCurrentSession();

  let detail: ResolvedJob | null = null;
  let loadError: string | null = null;

  // One resolver for every source: the stored corpus first, the board only when
  // the row is missing. It also enforces ownership of private postings.
  try {
    detail = await getJobDetail(boardToken, id, session?.user?.id ?? null);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load this posting.";
  }

  if (!detail && !loadError) notFound();

  const path = `/jobs/${boardToken}/${id}`;

  const facts = session?.user
    ? await prisma.profileFact.findMany({
        where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
        orderBy: { position: "asc" },
        select: { groupId: true, label: true, value: true },
      })
    : [];

  const factInput: FactForMatch[] = facts.map((fact) => ({
    group: fact.groupId,
    label: fact.label,
    value: fact.value,
  }));

  const match =
    detail && session?.user && factInput.length > 0
      ? await matchJob({
          userId: session.user.id,
          postingId: detail.posting.id,
          title: detail.posting.title,
          description: detail.description,
          facts: factInput,
        })
      : null;

  const referralCandidate = factInput.length > 0 ? buildCandidate(factInput) : null;
  const referral =
    detail && session?.user && referralCandidate
      ? buildReferralKit({
          company: detail.posting.company,
          role: detail.posting.title,
          name: facts.find((fact) => /full name|^name$/i.test(fact.label))?.value ?? null,
          city: facts.find((fact) => /city|location|based/i.test(fact.label))?.value ?? null,
          college: facts.find((fact) => /college|university|institute/i.test(fact.label))?.value ?? null,
          skills: referralCandidate.skills,
          years: referralCandidate.years,
          student: referralCandidate.student,
          graduationYear: referralCandidate.graduationYear,
        })
      : null;

  const tracked = detail && session?.user
    ? await prisma.application.findFirst({
        where: {
          userId: session.user.id,
          OR: [
            { postingUrl: detail.posting.url },
            { company: detail.posting.company, postingTitle: detail.posting.title },
          ],
        },
        select: { id: true, status: true },
      })
    : null;

  const gradeFact = facts.find((fact) => /grade|cgpa|gpa|percentage|marks/i.test(fact.label));
  const gradeText = gradeFact?.value ?? "";
  const cgpaMatch = gradeText.match(/([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*(?:\/\s*([0-9]{1,3}))?/);
  const percentageMatch = gradeText.match(/([0-9]{2}(?:\.[0-9])?)\s*%/);
  const graduationFact = facts.find((fact) => /graduat|passing|batch/i.test(fact.label));
  const graduationYear = graduationFact ? Number(graduationFact.value.match(/(20\d{2})/g)?.pop() ?? NaN) : NaN;

  const eligibility = detail
    ? checkEligibility(parseEligibility(detail.description), {
        cgpa: cgpaMatch && !percentageMatch ? Number(cgpaMatch[1]) : null,
        cgpaScale: cgpaMatch?.[2] ? Number(cgpaMatch[2]) : cgpaMatch ? 10 : null,
        percentage: percentageMatch ? Number(percentageMatch[1]) : null,
        graduationYear: Number.isFinite(graduationYear) ? graduationYear : null,
        degree: facts.find((fact) => /degree|discipline|course/i.test(fact.label))?.value ?? null,
      })
    : null;

  const trust = detail
    ? assessPosting({
        title: detail.posting.title,
        url: detail.posting.url,
        company: detail.posting.company,
        description: detail.description,
      })
    : null;

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href="/jobs">← All jobs</Link>
        </span>
      </header>

      <section aria-labelledby="job-title" className="onboarding-content onboarding-content-wide">
        {loadError ? (
          <div className="profile-empty">
            <p>This posting could not be loaded: {loadError}</p>
            <Link className="intake-secondary" href="/jobs">Back to jobs</Link>
          </div>
        ) : detail ? (
          <>
            <p className="section-kicker">
              {detail.posting.company} · {SOURCE_LABEL[detail.posting.source] ?? "public posting"}
            </p>
            <h1 id="job-title">{detail.posting.title}</h1>
            <p className="job-detail-meta">
              {detail.posting.location ? <span>{detail.posting.location}</span> : null}
              {detail.posting.department ? <span>{detail.posting.department}</span> : null}
              {formatSalary(detail.salaryMin, detail.salaryMax) ? (
                <span>{formatSalary(detail.salaryMin, detail.salaryMax)}</span>
              ) : null}
              {detail.postedAt ? (
                <span>Posting updated {updatedLabel(detail.postedAt)}</span>
              ) : detail.firstSeenAt ? (
                <span>First seen {updatedLabel(detail.firstSeenAt)}</span>
              ) : null}
              <span>Read from {detail.origin === "corpus" ? "the stored corpus" : "the employer's board"}</span>
              <a href={detail.posting.url} rel="noreferrer noopener" target="_blank">
                Apply on the employer&apos;s site ↗
              </a>
            </p>

            {tracked ? (
              <p className="doc-banner is-ok" role="status">
                <strong>Already in your tracker</strong> — this role was tracked before.{" "}
                <Link className="text-button" href={`/applications/${tracked.id}`}>
                  Open the application
                </Link>
              </p>
            ) : null}

            <div className="profile-links">
              <Link className="intake-secondary" href={`/jobs/${boardToken}/${id}/prepare`}>
                Tailor my resume <span aria-hidden="true">→</span>
              </Link>
              <Link className="intake-secondary" href={`/jobs/${boardToken}/${id}/answers`}>
                Get form answers <span aria-hidden="true">→</span>
              </Link>
            </div>

            {trust && trust.risk !== "low" ? (
              <div className={`job-trust-panel is-${trust.risk}`}>
                <h2>{trust.risk === "high" ? "Check this posting before you spend time" : "Worth a second look"}</h2>
                <ul>
                  {trust.flags.map((flag) => (
                    <li key={flag.label}>
                      <strong>{flag.label}.</strong> {flag.detail}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {eligibility && eligibility.rules.length > 0 ? (
              <div className={`job-eligibility is-${eligibility.verdict}`}>
                <h2>
                  {eligibility.verdict === "eligible"
                    ? "You meet the stated criteria"
                    : eligibility.verdict === "not-eligible"
                      ? "You do not meet the stated criteria"
                      : "Criteria you still need to check"}
                </h2>
                <ul>
                  {eligibility.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p>The posting says: {eligibility.rules.map((rule) => rule.text).join(" · ")}</p>
              </div>
            ) : null}

            {detail.warnings.length > 0 ? (
              <p className="job-warning" role="note">
                {detail.warnings.join(" ")} Treat the text with care and verify anything that looks unusual.
              </p>
            ) : null}

            {!session?.user ? (
              <div className="match-gate">
                <p>Sign in to see which requirements your confirmed profile supports.</p>
                <Link
                  className="onboarding-submit"
                  href={`/sign-in?next=${encodeURIComponent(path)}`}
                >
                  Sign in <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : factInput.length === 0 ? (
              <div className="match-gate">
                <p>Your profile has no confirmed facts yet, so there is nothing to compare against.</p>
                <Link className="onboarding-submit" href="/onboarding">
                  Start from your resume <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : null}

            {match ? (
              <section aria-labelledby="match-title" className="match-panel">
                <div className="match-head">
                  <h2 id="match-title">How you match this job</h2>
                  <span className="match-method">
                    {match.method === "ai"
                      ? "Read by Gemini, every quote checked against the job text and your facts"
                      : "Word overlap only (no model) — treat this as a rough guide"}
                  </span>
                </div>

                <p className="match-summary">
                  {match.counts.match === 0 ? (
                    <>
                      You do not clearly meet any of the <strong>{match.requirements.length}</strong> requirements
                    </>
                  ) : (
                    <>
                      You clearly meet <strong>{match.counts.match}</strong> of{" "}
                      <strong>{match.requirements.length}</strong> requirements
                    </>
                  )}
                  {match.counts.gap > 0 ? `, and ${match.counts.gap} look like gaps` : ""}
                  {match.counts.unknown > 0
                    ? `; ${match.counts.unknown} ${match.counts.unknown === 1 ? "needs" : "need"} checking`
                    : ""}
                  .
                </p>

                <ul className="match-counts">
                  {statusOrder.map((status) => (
                    <li className={`match-count status-${status}`} key={status}>
                      <span>{statusLabels[status]}</span>
                      <strong>{match.counts[status]}</strong>
                    </li>
                  ))}
                </ul>

                <ol className="req-list">
                  {match.requirements.map((requirement) => (
                    <li className={`req-card status-${requirement.status}`} key={requirement.id}>
                      <div className="req-head">
                        <span className={`req-status status-${requirement.status}`}>
                          {statusLabels[requirement.status]}
                        </span>
                        <span className="req-importance">{requirement.importance === "must" ? "Must have" : "Nice to have"}</span>
                      </div>
                      <p className="req-text">{requirement.text}</p>
                      <p className="req-source">
                        <span>From the posting</span>
                        <q>{requirement.source}</q>
                      </p>
                      {requirement.evidence ? (
                        <p className="req-evidence">
                          <span>Your profile says</span>
                          <q>{requirement.evidence}</q>
                        </p>
                      ) : null}
                      {requirement.note ? <p className="req-note">{requirement.note}</p> : null}
                    </li>
                  ))}
                </ol>

                <p className="jobs-note">
                  This compares the posting with your confirmed facts. It is not a prediction, and nothing is submitted
                  from here.
                </p>
              </section>
            ) : null}

            {referral ? (
              <section aria-labelledby="referrals-title" className="job-referrals">
                <div className="job-referrals-head">
                  <div>
                    <h2 id="referrals-title">People who could refer you</h2>
                    <p>
                      We do not read or store LinkedIn profiles. Each search opens in your own session, and the message is
                      written only from facts you confirmed.
                    </p>
                  </div>
                  <CopyText label="Copy message" text={referral.draft} />
                </div>

                <ul className="referral-links">
                  {referral.searches.map((search) => (
                    <li key={search.label}>
                      <a href={search.href} rel="noreferrer noopener" target="_blank">
                        {search.label} <span aria-hidden="true">↗</span>
                      </a>
                      <p>{search.detail}</p>
                    </li>
                  ))}
                </ul>

                <details className="referral-draft">
                  <summary>Read the message</summary>
                  <p>{referral.draft}</p>
                </details>
              </section>
            ) : null}

            <details className="job-description">
              <summary>Full job description</summary>
              <p>{detail.description}</p>
            </details>
          </>
        ) : null}
      </section>

      <footer className="onboarding-footer">
        <Link href="/jobs">← All jobs</Link>
        <span>Sources stay visible. You decide what to pursue.</span>
      </footer>
    </main>
  );
}
