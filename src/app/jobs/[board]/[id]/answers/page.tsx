import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { answerGroupLabels, buildAnswers, type AnswerGroup } from "@/lib/form/answers";
import { BOARDS } from "@/lib/jobs/boards";
import { getGreenhouseJob } from "@/lib/jobs/greenhouse-detail";
import { getCurrentSession } from "@/lib/session";
import CopyAnswer from "./copy-answer";

export const dynamic = "force-dynamic";

const groupOrder: AnswerGroup[] = ["contact", "education", "experience", "eligibility", "preferences"];

export default async function AnswersPage({
  params,
}: {
  params: Promise<{ board: string; id: string }>;
}) {
  const { board: boardToken, id } = await params;
  const board = BOARDS.find((entry) => entry.token === boardToken);
  if (!board) notFound();

  const detail = await getGreenhouseJob(board, id).catch(() => null);
  if (!detail) notFound();

  const session = await getCurrentSession();
  const facts = session?.user
    ? await prisma.profileFact.findMany({
        where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
        orderBy: { position: "asc" },
        select: { key: true, label: true, value: true },
      })
    : [];

  const answers = buildAnswers(facts);
  const known = answers.filter((answer) => answer.value);
  const missing = answers.filter((answer) => !answer.value);
  const bulk = known.map((answer) => `${answer.label}: ${answer.value}`).join("\n");
  const path = `/jobs/${boardToken}/${id}/answers`;

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

      <section aria-labelledby="answers-title" className="onboarding-content onboarding-content-wide">
        <p className="section-kicker">{detail.posting.company} · application answers</p>
        <h1 id="answers-title">Answers you can paste, with their source.</h1>
        <p className="onboarding-intro">
          These are the values employer forms usually ask for, taken only from facts you confirmed. Anything the profile
          does not answer stays visibly empty. Nothing is submitted from this page.
        </p>

        {!session?.user ? (
          <div className="match-gate">
            <p>Sign in to fill these from your profile.</p>
            <Link className="onboarding-submit" href={`/sign-in?next=${encodeURIComponent(path)}`}>
              Sign in <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : facts.length === 0 ? (
          <div className="match-gate">
            <p>Your profile has no confirmed facts yet.</p>
            <Link className="onboarding-submit" href="/onboarding">
              Start from your resume <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="answers-summary">
              <span>
                <strong>{known.length}</strong> ready to paste
              </span>
              <span>
                <strong>{missing.length}</strong> need your answer
              </span>
              <CopyAnswer label="Copy all answers" text={bulk} />
            </div>

            <div className="review-groups">
              {groupOrder.map((group) => {
                const items = answers.filter((answer) => answer.group === group);
                if (items.length === 0) return null;

                return (
                  <section aria-labelledby={`answers-${group}`} className="fact-group" key={group}>
                    <div className="fact-group-head">
                      <h2 id={`answers-${group}`}>{answerGroupLabels[group]}</h2>
                      <span>{items.filter((item) => item.value).length} of {items.length} answered</span>
                    </div>
                    <div className="answers-list">
                      {items.map((answer) => (
                        <div className={`answer-row${answer.value ? "" : " is-missing"}`} key={answer.id}>
                          <div className="answer-label">
                            <span>{answer.label}</span>
                            {answer.sourceLabel ? <small>from “{answer.sourceLabel}”</small> : null}
                          </div>
                          <div className="answer-value">
                            {answer.value ? <q>{answer.value}</q> : <em>Needs your answer</em>}
                            {answer.note ? <p>{answer.note}</p> : null}
                          </div>
                          {answer.value ? <CopyAnswer text={answer.value} /> : <span aria-hidden="true" />}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <p className="jobs-note">
              Prefer automation? The same answers are exposed at{" "}
              <code>/api/answers?board={boardToken}&amp;id={id}</code> for a future permission-scoped browser assistant. Any
              assistant will fill only clear fields, stop on ambiguity, and leave the submit button to you.
            </p>
          </>
        )}
      </section>

      <footer className="onboarding-footer">
        <Link href={`/jobs/${boardToken}/${id}`}>← Back to the posting</Link>
        <span>Copy, review, then submit it yourself.</span>
      </footer>
    </main>
  );
}
