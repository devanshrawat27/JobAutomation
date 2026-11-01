import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { BOARDS } from "@/lib/jobs/boards";
import { getGreenhouseJob } from "@/lib/jobs/greenhouse-detail";
import { createCoverLetter, createResume } from "@/app/actions/documents";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PreparePage({
  params,
  searchParams,
}: {
  params: Promise<{ board: string; id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { board: boardToken, id } = await params;
  const { error } = await searchParams;
  const failure = Array.isArray(error) ? error[0] : error;
  const board = BOARDS.find((entry) => entry.token === boardToken);
  if (!board) notFound();

  const detail = await getGreenhouseJob(board, id).catch(() => null);
  if (!detail) notFound();

  const session = await getCurrentSession();
  const facts = session?.user
    ? await prisma.profileFact.findMany({
        where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
        orderBy: { position: "asc" },
        select: { label: true, value: true },
      })
    : [];

  const path = `/jobs/${boardToken}/${id}/prepare`;

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href={`/jobs/${boardToken}/${id}`}>← Back to the posting</Link>
        </span>
      </header>

      <section aria-labelledby="prepare-title" className="onboarding-content">
        <p className="section-kicker">Preparation · cover letter</p>
        <h1 id="prepare-title">Write from what you can prove.</h1>
        <p className="onboarding-intro">
          The draft uses only your confirmed facts. Every paragraph cites the facts behind it, and any sentence with a number
          that is not in those facts is removed before you see it.
        </p>

        <div className="prepare-job">
          <span className="prepare-job-company">{detail.posting.company}</span>
          <strong>{detail.posting.title}</strong>
          {detail.posting.location ? <small>{detail.posting.location}</small> : null}
        </div>

        {!session?.user ? (
          <div className="match-gate">
            <p>Sign in to prepare a document from your profile.</p>
            <Link className="onboarding-submit" href={`/sign-in?next=${encodeURIComponent(path)}`}>
              Sign in <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : facts.length === 0 ? (
          <div className="match-gate">
            <p>Your profile has no confirmed facts yet, so there is nothing truthful to write from.</p>
            <Link className="onboarding-submit" href="/onboarding">
              Start from your resume <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="prepare-facts">
              <h2>{facts.length} confirmed facts available</h2>
              <ul>
                {facts.slice(0, 6).map((fact) => (
                  <li key={`${fact.label}-${fact.value}`}>
                    <span>{fact.label}</span>
                    {fact.value.length > 90 ? `${fact.value.slice(0, 87)}…` : fact.value}
                  </li>
                ))}
                {facts.length > 6 ? <li className="prepare-more">and {facts.length - 6} more</li> : null}
              </ul>
            </div>

            <p className="intake-note">
              <span aria-hidden="true">✳</span>
              <span>
                <strong>Leaves this server:</strong> the job text and these confirmed facts are sent to Google Gemini to
                write the draft. The posting itself is never modified.
              </span>
            </p>

            {failure ? (
              <p className="auth-error" role="alert">
                {failure === "resume"
                  ? "The tailored resume could not be built. Try again in a moment."
                  : "The draft could not be written. Try again in a moment."}
              </p>
            ) : null}

            <div className="prepare-actions">
              <form action={createCoverLetter}>
                <input name="board" type="hidden" value={boardToken} />
                <input name="id" type="hidden" value={id} />
                <button className="onboarding-submit" type="submit">
                  Write my cover letter <span aria-hidden="true">→</span>
                </button>
              </form>
              <form action={createResume}>
                <input name="board" type="hidden" value={boardToken} />
                <input name="id" type="hidden" value={id} />
                <button className="intake-secondary" type="submit">
                  Build a tailored resume <span aria-hidden="true">→</span>
                </button>
              </form>
            </div>
          </>
        )}

        <p className="intake-privacy">
          Nothing is submitted to the employer from here. The draft is saved to your account so you can copy it yourself.
        </p>
      </section>

      <footer className="onboarding-footer">
        <Link href={`/jobs/${boardToken}/${id}`}>← Back to the posting</Link>
        <span>Every claim traces back to a fact you confirmed.</span>
      </footer>
    </main>
  );
}
