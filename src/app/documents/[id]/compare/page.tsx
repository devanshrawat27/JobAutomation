import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { diffLines } from "@/lib/documents/diff";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(`/documents/${id}/compare`)}`);

  const current = await prisma.document.findFirst({ where: { id, userId: session.user.id } });
  if (!current) notFound();

  const previous = current.previousId
    ? await prisma.document.findFirst({ where: { id: current.previousId, userId: session.user.id } })
    : null;

  const diff = previous ? diffLines(previous.content, current.content) : [];
  const added = diff.filter((line) => line.type === "added").length;
  const removed = diff.filter((line) => line.type === "removed").length;

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href={`/documents/${current.id}`}>← Back to the document</Link>
        </span>
      </header>

      <section aria-labelledby="compare-title" className="onboarding-content onboarding-content-wide">
        <p className="section-kicker">{current.company} · version comparison</p>
        <h1 id="compare-title">What changed between versions.</h1>

        {!previous ? (
          <div className="profile-empty">
            <p>This is the first version, so there is nothing to compare it with.</p>
            <Link className="intake-secondary" href={`/documents/${current.id}`}>Open the document</Link>
          </div>
        ) : (
          <>
            <p className="onboarding-intro">
              {added} added line{added === 1 ? "" : "s"}, {removed} removed. Lines are compared exactly; a rebuilt document
              usually changes most of its wording even when the facts behind it did not change.
            </p>

            <dl className="compare-meta">
              <div>
                <dt>Previous</dt>
                <dd>{dateFormat.format(previous.createdAt)}</dd>
              </div>
              <div>
                <dt>This version</dt>
                <dd>{dateFormat.format(current.createdAt)}</dd>
              </div>
            </dl>

            <ol className="diff-view" aria-label="Line by line changes">
              {diff.map((line, index) => (
                <li className={`diff-line is-${line.type}`} key={`${line.type}-${index}`}>
                  <span className="diff-marker" aria-hidden="true">
                    {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                  </span>
                  <span className="sr-only">
                    {line.type === "added" ? "Added: " : line.type === "removed" ? "Removed: " : "Unchanged: "}
                  </span>
                  <span className="diff-text">{line.text || " "}</span>
                </li>
              ))}
            </ol>

            <p className="jobs-note">
              Old versions stay unchanged, so you can always see what an employer would have received.
            </p>
          </>
        )}
      </section>

      <footer className="onboarding-footer">
        <Link href={`/documents/${current.id}`}>← Back to the document</Link>
        <span>Every version is kept as it was sent.</span>
      </footer>
    </main>
  );
}
