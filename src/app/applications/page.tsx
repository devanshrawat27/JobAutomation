import Link from "next/link";

import AppShell from "@/components/app-shell";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

/** The columns a candidate actually thinks in, mapped onto the tracked statuses. */
const COLUMNS = [
  { key: "prepared", label: "Prepared", statuses: ["PREPARED"], hint: "Documents ready, not sent" },
  { key: "filled", label: "Form filled", statuses: ["FILLED"], hint: "Answers copied, not submitted" },
  { key: "submitted", label: "Submit attempted", statuses: ["SUBMIT_ATTEMPTED"], hint: "You pressed submit" },
  { key: "confirmed", label: "Receipt confirmed", statuses: ["RECEIPT_CONFIRMED"], hint: "The employer confirmed it" },
  { key: "interview", label: "Interview", statuses: ["INTERVIEW"], hint: "Talking to them" },
  { key: "offer", label: "Offer", statuses: ["OFFER"], hint: "An offer on the table" },
  { key: "closed", label: "Closed", statuses: ["REJECTED", "WITHDRAWN"], hint: "Rejected or withdrawn" },
] as const;

export default async function ApplicationsPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent("/applications")}`);

  const applications = await prisma.application.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      postingTitle: true,
      company: true,
      status: true,
      statusChangedAt: true,
      priority: true,
    },
  });

  return (
    <AppShell active="applications">
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href="/documents">Documents ↗</Link>
        </span>
      </header>

      <section aria-labelledby="applications-title" className="onboarding-content onboarding-content-wide">
        <p className="section-kicker">Your applications</p>
        <h1 id="applications-title">What you sent, and what you know.</h1>
        <p className="onboarding-intro">
          “Filled”, “submit attempted” and “receipt confirmed” stay separate here. An uncertain submit never becomes a
          confirmed application by itself.
        </p>

        {applications.length === 0 ? (
          <div className="profile-empty">
            <p>Nothing tracked yet. Start from a prepared document.</p>
            <Link className="intake-secondary" href="/documents">Open documents</Link>
          </div>
        ) : (
          <div className="app-board" role="list">
            {COLUMNS.map((column) => {
              const cards = applications.filter((application) => (column.statuses as readonly string[]).includes(application.status));
              return (
                <section aria-labelledby={`col-${column.key}`} className="app-column" key={column.key} role="listitem">
                  <div className="app-col-head">
                    <h2 id={`col-${column.key}`}>{column.label}</h2>
                    <span>{cards.length}</span>
                  </div>
                  <p className="app-col-hint">{column.hint}</p>
                  <div className="app-col-body">
                    {cards.length === 0 ? (
                      <p className="app-col-empty">Nothing here.</p>
                    ) : (
                      cards.map((application) => (
                        <Link className="app-card" href={`/applications/${application.id}`} key={application.id}>
                          <strong>{application.postingTitle}</strong>
                          <small>{application.company}</small>
                          <time dateTime={application.statusChangedAt.toISOString()}>
                            {dateFormat.format(application.statusChangedAt)}
                          </time>
                          {application.priority > 0 ? (
                            <span aria-label={`Priority ${application.priority} of 5`} className="app-priority">
                              {"★".repeat(application.priority)}
                              <span aria-hidden="true">{"★".repeat(5 - application.priority)}</span>
                            </span>
                          ) : null}
                        </Link>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <footer className="onboarding-footer">
        <Link href="/">← Back to home</Link>
        <span>Your records, your evidence.</span>
      </footer>
    </main>
    </AppShell>
  );
}
