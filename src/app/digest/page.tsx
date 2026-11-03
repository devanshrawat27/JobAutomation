import Link from "next/link";
import { redirect } from "next/navigation";

import AppShell from "@/components/app-shell";
import { prisma } from "@/lib/db";
import { visiblePostings } from "@/lib/jobs/detail";
import { buildCandidate, entryFriendly, matchPosting } from "@/lib/jobs/match";
import { listingWindowWhere } from "@/lib/jobs/window";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

const AREAS = [
  ["contact", "Contact"],
  ["education", "Education"],
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["skills", "Skills"],
] as const;

/**
 * What changed since you last looked.
 *
 * The in-app version of a daily digest: no inbox, no bot token, and every line
 * is something the app can prove from its own tables.
 */
export default async function DigestPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent("/digest")}`);

  // eslint-disable-next-line react-hooks/purity -- server component; the clock is the subject
  const now = Date.now();
  const twoDaysAgo = new Date(now - 2 * 86_400_000);
  const weekAgo = new Date(now - 7 * 86_400_000);
  const tenDaysAgo = new Date(now - 10 * 86_400_000);

  const [facts, postings, applications] = await Promise.all([
    prisma.profileFact.findMany({
      where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
      select: { label: true, value: true, groupId: true },
    }),
    prisma.jobPosting.findMany({
      where: {
        closedAt: null,
        AND: [visiblePostings(session.user.id), listingWindowWhere()],
      },
      select: {
        id: true,
        board: true,
        externalId: true,
        company: true,
        title: true,
        location: true,
        department: true,
        description: true,
        skills: true,
        seniority: true,
        yearsMin: true,
        remote: true,
        postedAt: true,
        firstSeenAt: true,
      },
      take: 2000,
    }),
    prisma.application.findMany({
      where: { userId: session.user.id },
      orderBy: { statusChangedAt: "asc" },
      select: { id: true, postingTitle: true, company: true, status: true, statusChangedAt: true },
    }),
  ]);

  const candidate = buildCandidate(facts.map((fact) => ({ label: fact.label, value: fact.value, group: fact.groupId })));

  const scored = postings.map((posting) => ({
    posting,
    fit: matchPosting(
      {
        ...posting,
        updatedAt: (posting.postedAt ?? posting.firstSeenAt).toISOString(),
        source: posting.board === "whoishiring" ? "hn" : posting.board === "pasted" ? "manual" : "greenhouse",
      },
      candidate,
    ),
  }));

  const fresh = scored
    .filter((entry) => entry.posting.firstSeenAt >= twoDaysAgo && entry.fit.score >= 50)
    .sort((left, right) => right.fit.score - left.fit.score)
    .slice(0, 6);

  const closing = scored
    .filter((entry) => {
      if (entry.fit.score < 50 || !entry.posting.postedAt) return false;
      return entry.posting.postedAt < tenDaysAgo;
    })
    .sort((left, right) => (left.posting.postedAt?.getTime() ?? 0) - (right.posting.postedAt?.getTime() ?? 0))
    .slice(0, 5);

  const followUps = applications.filter(
    (application) =>
      ["FILLED", "SUBMIT_ATTEMPTED"].includes(application.status) && application.statusChangedAt < weekAgo,
  );

  const missingAreas = AREAS.filter(([id]) => !facts.some((fact) => fact.groupId === id)).map(([, label]) => label);

  return (
    <AppShell active="digest">
      <main className="onboarding-page">
        <section aria-labelledby="digest-title" className="onboarding-content onboarding-content-wide">
          <p className="section-kicker">Since your last visit</p>
          <h1 id="digest-title">Digest</h1>
          <p className="onboarding-intro">
            Everything here is computed from your own records: new matches from the last two days, applications that have
            waited a week, and postings about to leave the board.
          </p>

          <div className="digest-grid">
            <section aria-labelledby="digest-new" className="digest-card">
              <div className="fact-group-head">
                <h2 id="digest-new">New matches</h2>
                <span>{fresh.length}</span>
              </div>
              {fresh.length === 0 ? (
                <p className="digest-empty">Nothing new scored above your shortlist line in the last two days.</p>
              ) : (
                <ul className="digest-list">
                  {fresh.map(({ posting, fit }) => (
                    <li key={posting.id}>
                      <Link href={`/jobs/${posting.board}/${posting.externalId}`}>{posting.title}</Link>
                      <span>
                        {posting.company} · {fit.score} match
                        {entryFriendly(posting) ? " · entry level" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="digest-closing" className="digest-card">
              <div className="fact-group-head">
                <h2 id="digest-closing">Leaving soon</h2>
                <span>{closing.length}</span>
              </div>
              {closing.length === 0 ? (
                <p className="digest-empty">No shortlisted posting is close to the two-week line.</p>
              ) : (
                <ul className="digest-list">
                  {closing.map(({ posting, fit }) => (
                    <li key={posting.id}>
                      <Link href={`/jobs/${posting.board}/${posting.externalId}`}>{posting.title}</Link>
                      <span>
                        {posting.company} · posted {posting.postedAt ? dateFormat.format(posting.postedAt) : "—"} · {fit.score}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="digest-followup" className="digest-card">
              <div className="fact-group-head">
                <h2 id="digest-followup">Waiting on you</h2>
                <span>{followUps.length}</span>
              </div>
              {followUps.length === 0 ? (
                <p className="digest-empty">No application has been sitting unchanged for a week.</p>
              ) : (
                <ul className="digest-list">
                  {followUps.map((application) => (
                    <li key={application.id}>
                      <Link href={`/applications/${application.id}`}>{application.postingTitle}</Link>
                      <span>
                        {application.company} · last change {dateFormat.format(application.statusChangedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="digest-profile" className="digest-card">
              <div className="fact-group-head">
                <h2 id="digest-profile">Profile gaps</h2>
                <span>{missingAreas.length}</span>
              </div>
              {missingAreas.length === 0 ? (
                <p className="digest-empty">Every area has at least one confirmed fact.</p>
              ) : (
                <>
                  <p className="digest-empty">Still empty: {missingAreas.join(", ")}.</p>
                  <Link className="intake-secondary" href="/onboarding/resume?path=new-grad&new=1">
                    Add a resume <span aria-hidden="true">→</span>
                  </Link>
                </>
              )}
            </section>
          </div>
        </section>

        <footer className="onboarding-footer">
          <Link href="/jobs">← Back to jobs</Link>
          <span>Computed from your records. Nothing is sent to an employer.</span>
        </footer>
      </main>
    </AppShell>
  );
}
