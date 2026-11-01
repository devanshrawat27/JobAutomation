import Link from "next/link";

import AppShell from "@/components/app-shell";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

export default async function DocumentsPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent("/documents")}`);

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      postingTitle: true,
      company: true,
      createdAt: true,
      factKeys: true,
    },
  });

  return (
    <AppShell active="documents">
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href="/profile">Your profile ↗</Link>
        </span>
      </header>

      <section aria-labelledby="documents-title" className="onboarding-content onboarding-content-wide">
        <p className="section-kicker">Saved drafts</p>
        <h1 id="documents-title">Documents, tied to their evidence.</h1>
        <p className="onboarding-intro">
          Every draft keeps the fact keys it was written from, so you can see later what it claimed and where that came from.
        </p>

        {documents.length === 0 ? (
          <div className="profile-empty">
            <p>No documents yet.</p>
            <Link className="intake-secondary" href="/jobs">
              Find a job to prepare for
            </Link>
          </div>
        ) : (
          <ul className="doc-list">
            {documents.map((document) => (
              <li className="doc-card" key={document.id}>
                <div>
                  <h2>
                    <Link href={`/documents/${document.id}`}>{document.postingTitle}</Link>
                  </h2>
                  <p className="job-card-meta">
                    <span>{document.company}</span>
                    <span aria-hidden="true">·</span>
                    <span>{document.kind === "RESUME" ? "Tailored resume" : "Cover letter"}</span>
                  </p>
                </div>
                <div className="job-card-side">
                  <span className="job-updated">{dateFormat.format(document.createdAt)}</span>
                  <span className="job-updated">{document.factKeys.length} facts cited</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="onboarding-footer">
        <Link href="/">← Back to home</Link>
        <span>Drafts stay editable copies. Sending is yours.</span>
      </footer>
    </main>
    </AppShell>
  );
}
