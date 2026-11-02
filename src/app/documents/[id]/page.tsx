import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createApplication } from "@/app/actions/applications";
import { rebuildDocument, regenerateWithFixes, updateDocumentContent } from "@/app/actions/documents";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import CopyButton from "./copy-button";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type ResumeData = {
  headline?: string;
  summary?: string;
  sections?: Array<{ title: string; lines: Array<{ text: string; factKeys?: string[] }> }>;
  flags?: string[];
};

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; numbers?: string }>;
}) {
  const { id } = await params;
  const { saved, error, numbers } = await searchParams;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(`/documents/${id}`)}`);

  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!document) notFound();

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id, key: { in: document.factKeys } },
    orderBy: { position: "asc" },
    select: { key: true, label: true, value: true },
  });

  const application = await prisma.application.findFirst({
    where: { userId: session.user.id, postingId: document.postingId },
    select: { id: true },
  });

  const isResume = document.kind === "RESUME";
  const resume = isResume ? (document.data as ResumeData | null) : null;

  // Version chain: walk back through rebuilds, then forward to the newest.
  const chain: string[] = [document.id];
  let cursor = document.previousId;
  for (let index = 0; index < 10 && cursor; index += 1) {
    const previous = await prisma.document.findFirst({
      where: { id: cursor, userId: session.user.id },
      select: { id: true, previousId: true },
    });
    if (!previous) break;
    chain.unshift(previous.id);
    cursor = previous.previousId;
  }
  let forward = document.id;
  for (let index = 0; index < 10; index += 1) {
    const nextDocument = await prisma.document.findFirst({
      where: { previousId: forward, userId: session.user.id },
      select: { id: true },
    });
    if (!nextDocument) break;
    chain.push(nextDocument.id);
    forward = nextDocument.id;
  }
  const versionNumber = chain.indexOf(document.id) + 1;
  const previousId = versionNumber > 1 ? chain[versionNumber - 2] : null;
  const nextId = versionNumber < chain.length ? chain[versionNumber] : null;

  const review = document.review as
    | {
        status?: string;
        verdict?: string;
        reason?: string;
        issues?: Array<{ severity: string; quote: string; problem: string; fix: string }>;
      }
    | null;

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href="/documents">← All documents</Link>
        </span>
      </header>

      <section aria-labelledby="document-title" className="onboarding-content onboarding-content-wide">
        <p className="section-kicker">
          {document.company} · {isResume ? "tailored resume" : "cover letter"}
        </p>
        <h1 id="document-title">{document.postingTitle}</h1>
        <p className="job-detail-meta">
          <span>{isResume ? "Built" : "Drafted"} {dateFormat.format(document.createdAt)}</span>
          {document.editedAt ? <span>Edited {dateFormat.format(document.editedAt)}</span> : null}
          <span>{document.factKeys.length} facts cited</span>
          {chain.length > 1 ? (
            <span className="doc-version">
              Version {versionNumber} of {chain.length}
              {previousId ? (
                <>
                  {" · "}
                  <Link href={`/documents/${previousId}`}>previous</Link>
                </>
              ) : null}
              {nextId ? (
                <>
                  {" · "}
                  <Link href={`/documents/${nextId}`}>newer</Link>
                </>
              ) : null}
              {previousId ? (
                <>
                  {" · "}
                  <Link href={`/documents/${document.id}/compare`}>compare</Link>
                </>
              ) : null}
            </span>
          ) : null}
          <a href={document.postingUrl} rel="noreferrer noopener" target="_blank">
            Original posting ↗
          </a>
        </p>

        {saved ? <p className="doc-banner is-ok" role="status">Saved. Your edits are stored on this account.</p> : null}
        {error === "numbers" ? (
          <p className="auth-error" role="alert">
            Not saved: {numbers ? `${numbers} ` : "a number "}does not appear in the facts this letter cites. Remove it or add
            the fact first.
          </p>
        ) : null}
        {error === "content" ? (
          <p className="auth-error" role="alert">Not saved: the letter must be between 40 and 8,000 characters.</p>
        ) : null}

        {isResume && resume ? (
          <article className="resume-sheet" aria-label="Tailored resume">
            <header className="resume-head">
              <p className="resume-headline">{resume.headline}</p>
              {resume.summary ? <p className="resume-summary">{resume.summary}</p> : null}
            </header>
            {resume.sections?.map((section) => (
              <section className="resume-section" key={section.title}>
                <h2>{section.title}</h2>
                <ul>
                  {section.lines.map((line, index) => (
                    <li key={`${section.title}-${index}`}>{line.text}</li>
                  ))}
                </ul>
              </section>
            ))}
            {resume.flags && resume.flags.length > 0 ? (
              <details className="resume-flags">
                <summary>{resume.flags.length} line(s) removed by the fact guard</summary>
                <ul>
                  {resume.flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>
        ) : (
          <form action={updateDocumentContent} className="doc-editor">
            <input name="id" type="hidden" value={document.id} />
            <label className="sr-only" htmlFor="doc-content">Cover letter text</label>
            <textarea defaultValue={document.content} id="doc-content" name="content" rows={16} spellCheck />
            <div className="doc-actions">
              <button className="onboarding-submit" type="submit">
                Save changes <span aria-hidden="true">→</span>
              </button>
            </div>
            <p className="jobs-note">
              Editing is yours. If you add a number that is not in the cited facts, the save is refused rather than stored.
            </p>
          </form>
        )}

        <div className="doc-actions">
          <a className="intake-secondary" href={`/documents/${document.id}/pdf`}>
            Download PDF <span aria-hidden="true">↓</span>
          </a>
          <CopyButton text={document.content} />
          <form action={rebuildDocument}>
            <input name="id" type="hidden" value={document.id} />
            <button className="intake-secondary" type="submit">
              Rebuild from current profile <span aria-hidden="true">↻</span>
            </button>
          </form>
          {application ? (
            <Link className="intake-secondary" href={`/applications/${application.id}`}>
              Open tracked application <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <form action={createApplication}>
              <input name="documentId" type="hidden" value={document.id} />
              <button className="intake-secondary" type="submit">
                Track this application <span aria-hidden="true">→</span>
              </button>
            </form>
          )}
          <Link
            className="intake-secondary"
            href={`/jobs/${document.postingId.split(":")[1]}/${document.postingId.split(":")[2]}`}
          >
            Back to the posting
          </Link>
        </div>

        {review?.verdict ? (
          <section className="doc-review" aria-labelledby="review-title">
            <div className="doc-review-head">
              <h2 id="review-title">Reviewer notes</h2>
              <span
                className={`review-verdict is-${
                  review.verdict === "ok" ? "ok" : review.verdict === "unavailable" ? "warn" : "warn"
                }`}
              >
                {review.verdict === "ok"
                  ? "No problems found"
                  : review.verdict === "unavailable"
                    ? "Reviewer did not run"
                    : "Needs a look"}
              </span>
            </div>
            {review.verdict === "unavailable" ? (
              <p className="auth-error" role="alert">
                {review.reason ?? "The second pass could not run, so this draft has only the number check."} A missing
                review is not a clean review.
              </p>
            ) : review.issues && review.issues.length > 0 ? (
              <ul>
                {review.issues.map((issue, index) => (
                  <li key={`${issue.quote}-${index}`} className={`review-issue severity-${issue.severity}`}>
                    <span className="review-severity">{issue.severity}</span>
                    <q>{issue.quote}</q>
                    <p>{issue.problem}</p>
                    <small>{issue.fix}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="jobs-note">A second pass read the draft against your facts and found nothing to change.</p>
            )}
            {review.issues && review.issues.length > 0 ? (
              <form action={regenerateWithFixes} className="doc-review-actions">
                <input name="id" type="hidden" value={document.id} />
                <button className="onboarding-submit" type="submit">
                  Regenerate with these fixes <span aria-hidden="true">↻</span>
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        <section aria-labelledby="evidence-title" className="doc-evidence">
          <h2 id="evidence-title">Facts this document cites</h2>
          <ul>
            {facts.map((fact) => (
              <li key={fact.key}>
                <span>{fact.label}</span>
                <q>{fact.value}</q>
              </li>
            ))}
          </ul>
          <p className="jobs-note">
            Written by {document.model ?? "the configured model"}, then filtered: any line whose numbers could not be found
            in these facts was removed before it was saved.
          </p>
        </section>
      </section>

      <footer className="onboarding-footer">
        <Link href="/documents">← All documents</Link>
        <span>Review, edit, then send it yourself.</span>
      </footer>
    </main>
  );
}
