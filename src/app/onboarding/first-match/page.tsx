import Link from "next/link";
import { redirect } from "next/navigation";

import MatchDonut from "@/components/match-donut";
import { formatSalary } from "@/lib/jobs/salary";
import { getCurrentSession } from "@/lib/session";
import { getDashboardData } from "@/lib/dashboard/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your first match — JobAutomation" };

const VERDICT = {
  strong: "Strong match",
  good: "Good match",
  possible: "Possible match",
  weak: "Weak match",
} as const;

export default async function FirstMatchPage() {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect(`/sign-in?next=${encodeURIComponent("/onboarding/first-match")}`);
  }

  const data = await getDashboardData(session.user.id);
  if (data.factsCount === 0) redirect("/onboarding");
  const job = data.matches[0];

  if (!job) {
    return (
      <main className="onboarding-page">
        <header className="onboarding-header">
          <Link aria-label="JobAutomation home" className="brand" href="/">
            <span aria-hidden="true" className="brand-mark"><span /></span>
            <span>jobautomation</span>
          </Link>
          <span className="onboarding-step">Before your first match</span>
        </header>

        <div className="wiz-shell">
          <aside className="wiz-aside" aria-hidden="true">
            <span className="wiz-aside-glyph">—</span>
            <div className="wiz-aside-top">
              <p className="wiz-aside-kicker">Your first match</p>
              <p className="wiz-aside-line">a quiet day.</p>
            </div>
          </aside>
          <section className="wiz-main" aria-labelledby="none-title">
            <p className="wiz-main-kicker">Step 8 of 8</p>
            <h1 id="none-title">Nothing clears the bar today.</h1>
            <p className="onboarding-intro">
              No open role above 14 days old fits what you told us. Widen one answer — a city, or your expected pay — and
              the feed will fill.
            </p>
            <div className="wiz-nav">
              <Link className="wiz-back" href="/dashboard">← Your overview</Link>
              <Link className="wiz-next" href="/onboarding/preferences">
                Edit my answers <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const note = [
    job.reasons[0]?.replace(/([^.])$/, "$1."),
    job.missing.length > 0
      ? `The posting also names ${job.missing.slice(0, 2).join(" and ")}, which is not on your profile — the draft will leave those out unless you add real evidence.`
      : null,
    "We will prepare the documents and the answers. You review them and press submit yourself.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          {data.matchPool > 1 ? `${data.matchPool} open roles clear the bar` : "1 open role clears the bar"}
        </span>
      </header>

      <div className="wiz-shell">
        <aside className="wiz-aside" aria-hidden="true">
          <span className="wiz-aside-glyph">{job.score}</span>
          <div className="wiz-aside-top">
            <p className="wiz-aside-kicker">Your first match</p>
            <p className="wiz-aside-line">the first step.</p>
          </div>
          <div className="wiz-aside-foot">
            <div className="wiz-track-bar"><i style={{ width: "100%" }} /></div>
            <p className="wiz-aside-note">
              {data.matchPool > 1 ? `${data.matchPool} roles above the bar · 14-day window` : "One role above the bar"}
            </p>
          </div>
        </aside>

        <section aria-labelledby="first-title" className="wiz-main">
          <p className="wiz-main-kicker">Before your first application</p>
          <h1 id="first-title">We found your first match.</h1>
          <p className="onboarding-intro">
            One role, ranked from what you confirmed. {data.matches.length > 1 ? "More are lined up right behind it." : ""}{" "}
            Nothing has been sent anywhere.
          </p>

          <article className="first-match">
            <div className="first-match-head">
              <MatchDonut score={job.score} verdict={job.verdict} size={68} />
              <div>
                <p className="first-match-verdict">{VERDICT[job.verdict]}</p>
                <h2>{job.title}</h2>
                <p className="first-match-meta">
                  <span>{job.company}</span>
                  {job.location ? <span>{job.location}</span> : null}
                  {salary ? <span>{salary}</span> : null}
                  {job.entry ? <span>Entry level</span> : null}
                </p>
              </div>
            </div>

            <div className="first-match-note">
              <p className="section-kicker">A note for you</p>
              <p>{note}</p>
            </div>

            <div className="job-fit-lists">
              <div>
                <h3>Matches</h3>
                <ul>
                  {job.matched.slice(0, 6).map((skill) => <li key={skill}>✓ {skill}</li>)}
                  {job.reasons.slice(1, 3).map((reason) => <li key={reason}>{reason}</li>)}
                  {job.matched.length === 0 && job.reasons.length === 0 ? <li>The posting names little we can check.</li> : null}
                </ul>
              </div>
              <div>
                <h3>Gaps</h3>
                <ul>
                  {job.missing.length > 0 ? (
                    job.missing.slice(0, 4).map((skill) => <li key={skill}>{skill} — not on your profile</li>)
                  ) : (
                    <li>No named skill is missing.</li>
                  )}
                </ul>
              </div>
            </div>
          </article>

          <div className="wiz-nav">
            <Link className="wiz-back" href="/jobs?view=for-you">
              <span aria-hidden="true">←</span> Show me more
            </Link>
            <Link className="wiz-next" href={`/jobs/${job.board}/${job.externalId}`}>
              Open this job <span aria-hidden="true">→</span>
            </Link>
          </div>

          <p className="wiz-skip">
            <Link href="/onboarding/preferences">Something off? Edit my answers</Link>
            <span>·</span>
            <Link href="/dashboard">Go to your overview</Link>
          </p>

          <p className="wiz-fineprint">
            Your agent prepares; you submit. JobAutomation does not sign in to job boards, does not hold passwords and does
            not auto-apply.
          </p>
        </section>
      </div>

      <footer className="onboarding-footer">
        <Link href="/dashboard">← Your overview</Link>
        <span>Everything here comes from facts you confirmed.</span>
      </footer>
    </main>
  );
}
