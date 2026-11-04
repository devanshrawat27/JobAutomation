import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { setApplicationPriority, setApplicationStatus } from "@/app/actions/applications";
import CopyText from "@/components/copy-text";
import { diffProfile, type SnapshotFact } from "@/lib/applications/diff";
import { statusGroups, statusHints, statusLabels } from "@/lib/applications/status";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { id } = await params;
  const { updated, error } = await searchParams;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(`/applications/${id}`)}`);

  const application = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 30 },
      document: { select: { id: true, postingTitle: true } },
    },
  });
  if (!application) notFound();

  const currentFacts = await prisma.profileFact.findMany({
    where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
    orderBy: { position: "asc" },
    select: { key: true, label: true, value: true },
  });

  const snapshot = Array.isArray(application.profileSnapshot)
    ? (application.profileSnapshot as unknown as SnapshotFact[])
    : null;
  const diff = snapshot ? diffProfile(snapshot, currentFacts) : null;
  const reference = `JA-${application.id.slice(-8).toUpperCase()}`;

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href="/applications">← All applications</Link>
        </span>
      </header>

      <section aria-labelledby="application-title" className="onboarding-content onboarding-content-wide">
        <p className="section-kicker">{application.company}</p>
        <h1 id="application-title">{application.postingTitle}</h1>
        <p className="job-detail-meta">
          <span className={`app-status status-${application.status.toLowerCase()}`}>
            {statusLabels[application.status]}
          </span>
          <span>Since {dateFormat.format(application.statusChangedAt)}</span>
          <span>{application.profileFactCount} facts behind the document</span>
          <a href={application.postingUrl} rel="noreferrer noopener" target="_blank">
            Original posting ↗
          </a>
        </p>

        <p className="app-hint">{statusHints[application.status]}</p>

        <section aria-labelledby="receipt-title" className="app-receipt">
          <div className="fact-group-head">
            <h2 id="receipt-title">Receipt</h2>
            <span>{statusLabels[application.status]}</span>
          </div>
          <dl>
            <div>
              <dt>Reference</dt>
              <dd><code>{reference}</code></dd>
            </div>
            <div>
              <dt>Prepared</dt>
              <dd>{dateFormat.format(application.createdAt)}</dd>
            </div>
            <div>
              <dt>Last change</dt>
              <dd>{dateFormat.format(application.statusChangedAt)}</dd>
            </div>
            <div>
              <dt>Document</dt>
              <dd>
                {application.document ? (
                  <Link href={`/documents/${application.document.id}`}>{application.document.postingTitle}</Link>
                ) : (
                  "No document linked"
                )}
              </dd>
            </div>
            <div>
              <dt>Profile snapshot</dt>
              <dd><code>{application.profileHash ?? "not recorded"}</code></dd>
            </div>
          </dl>
          <div className="app-receipt-foot">
            <CopyText label="Copy reference" text={`${reference} · ${application.postingTitle} · ${application.company}`} />
            <p>
              “Receipt confirmed” is for evidence you actually hold — a confirmation page, an email, or a reference number
              from the employer. An uncertain submit stays “submit attempted”.
            </p>
          </div>
        </section>

        <section aria-labelledby="priority-title" className="app-priority-panel">
          <div className="fact-group-head">
            <h2 id="priority-title">How much does this role matter?</h2>
            <span>{application.priority > 0 ? `${application.priority} of 5` : "not rated"}</span>
          </div>
          <form action={setApplicationPriority} className="app-priority-form">
            <input name="id" type="hidden" value={application.id} />
            <div className="app-priority-buttons">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  aria-label={`Rate ${value} of 5`}
                  aria-pressed={application.priority === value}
                  className={application.priority >= value ? "is-on" : ""}
                  key={value}
                  name="priority"
                  type="submit"
                  value={value}
                >
                  ★
                </button>
              ))}
            </div>
            {application.priority > 0 ? (
              <button className="text-button" name="priority" type="submit" value={0}>
                Clear rating
              </button>
            ) : null}
          </form>
        </section>

        {updated ? <p className="doc-banner is-ok" role="status">Status updated. The change is recorded below.</p> : null}
        {error === "status" ? (
          <p className="auth-error" role="alert">That status is not recognised. Nothing was changed.</p>
        ) : null}

        <div className="app-layout">
          <form action={setApplicationStatus} className="app-form">
            <input name="id" type="hidden" value={application.id} />
            <label className="jobs-field">
              <span>Status</span>
              <select defaultValue={application.status} name="status">
                {statusGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option} value={option}>{statusLabels[option]}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="jobs-field">
              <span>Note (optional)</span>
              <input defaultValue={application.note ?? ""} maxLength={600} name="note" placeholder="e.g. confirmation email received" />
            </label>
            <button className="onboarding-submit" type="submit">
              Update status <span aria-hidden="true">→</span>
            </button>
            <p className="jobs-note">
              Choosing “receipt confirmed” means you have evidence. If a submit timed out, use “submit attempted” and verify
              with the employer first.
            </p>
          </form>

          <div className="app-links">
            {application.document ? (
              <Link className="intake-secondary" href={`/documents/${application.document.id}`}>
                Open the document <span aria-hidden="true">→</span>
              </Link>
            ) : null}
            <Link className="intake-secondary" href="/applications">All applications</Link>
          </div>
        </div>

        <section aria-labelledby="diff-title" className="app-diff">
          <h2 id="diff-title">Profile changes since tracking</h2>
          {!diff ? (
            <p className="jobs-note">No snapshot was recorded for this application, so there is nothing to compare.</p>
          ) : diff.total === 0 ? (
            <p className="jobs-note">No changes. The facts behind this document still match your profile.</p>
          ) : (
            <>
              <ul className="diff-list">
                {diff.changed.slice(0, 12).map((change) => (
                  <li className="diff-changed" key={`c-${change.key}`}>
                    <span>Changed</span>
                    <strong>{change.label}</strong>
                    <q>{change.from}</q>
                    <span aria-hidden="true">→</span>
                    <q>{change.to}</q>
                  </li>
                ))}
                {diff.added.slice(0, 12).map((change) => (
                  <li className="diff-added" key={`a-${change.key}`}>
                    <span>Added</span>
                    <strong>{change.label}</strong>
                    <q>{change.to}</q>
                  </li>
                ))}
                {diff.removed.slice(0, 12).map((change) => (
                  <li className="diff-removed" key={`r-${change.key}`}>
                    <span>Removed</span>
                    <strong>{change.label}</strong>
                    <q>{change.from}</q>
                  </li>
                ))}
              </ul>
              <p className="jobs-note">
                The document was written from the pinned snapshot, not from these later edits. Rebuild it if the change
                matters for this employer.
              </p>
            </>
          )}
        </section>

        <section aria-labelledby="timeline-title" className="app-timeline">
          <h2 id="timeline-title">History</h2>
          <ol>
            {application.events.map((event) => (
              <li key={event.id}>
                <span className={`app-status status-${event.status.toLowerCase()}`}>{statusLabels[event.status]}</span>
                <time dateTime={event.createdAt.toISOString()}>{dateFormat.format(event.createdAt)}</time>
                {event.note ? <p>{event.note}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      </section>

      <footer className="onboarding-footer">
        <Link href="/applications">← All applications</Link>
        <span>Your records, your evidence.</span>
      </footer>
    </main>
  );
}
