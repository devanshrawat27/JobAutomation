import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { BOARDS } from "@/lib/jobs/boards";
import { getGreenhouseJob, type JobDetail } from "@/lib/jobs/greenhouse-detail";
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

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ board: string; id: string }>;
}) {
  const { board: boardToken, id } = await params;
  const board = BOARDS.find((entry) => entry.token === boardToken);
  if (!board) notFound();

  let detail: JobDetail | null = null;
  let loadError: string | null = null;

  try {
    detail = await getGreenhouseJob(board, id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load this posting.";
  }

  if (!detail && !loadError) notFound();

  const session = await getCurrentSession();
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
            <p className="section-kicker">{detail.posting.company} · public board</p>
            <h1 id="job-title">{detail.posting.title}</h1>
            <p className="job-detail-meta">
              {detail.posting.location ? <span>{detail.posting.location}</span> : null}
              {detail.posting.department ? <span>{detail.posting.department}</span> : null}
              {updatedLabel(detail.posting.updatedAt) ? (
                <span>Updated {updatedLabel(detail.posting.updatedAt)}</span>
              ) : null}
              <a href={detail.posting.url} rel="noreferrer noopener" target="_blank">
                View original posting ↗
              </a>
            </p>

            <div className="profile-links">
              <Link className="intake-secondary" href={`/jobs/${boardToken}/${id}/prepare`}>
                Prepare an application <span aria-hidden="true">→</span>
              </Link>
              <Link className="intake-secondary" href={`/jobs/${boardToken}/${id}/answers`}>
                Application answers <span aria-hidden="true">→</span>
              </Link>
            </div>

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
                  <h2 id="match-title">How your profile answers this job</h2>
                  <span className="match-method">
                    {match.method === "ai"
                      ? "Read by Gemini, every quote checked against the job text and your facts"
                      : "Word overlap only (no model) — treat this as a rough guide"}
                  </span>
                </div>

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
                  This is a reading aid, not a prediction. Nothing is scored, nothing is submitted, and applying still
                  happens on the employer’s site.
                </p>
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
