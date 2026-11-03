import Link from "next/link";
import { redirect } from "next/navigation";

import AppShell from "@/components/app-shell";
import MatchDonut from "@/components/match-donut";
import { setJobDecision } from "@/app/actions/jobs";
import { FOLLOW_UP_DAYS, getDashboardData, NEW_MATCH_DAYS, SCAN_STALE_MINUTES } from "@/lib/dashboard/data";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
const dayTime = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(value: Date | null): string {
  if (!value) return "never";
  const diff = value.getTime() - Date.now();
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 36) return relative.format(hours, "hour");
  return relative.format(Math.round(diff / 86_400_000), "day");
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function eligibilityLabel(match: { eligibility: { verdict: string } | null }): {
  label: string;
  tone: "ok" | "warn" | "bad" | "muted";
} {
  if (!match.eligibility) return { label: "Criteria not stated", tone: "muted" };
  if (match.eligibility.verdict === "eligible") return { label: "Eligible", tone: "ok" };
  if (match.eligibility.verdict === "not-eligible") return { label: "Not eligible", tone: "bad" };
  return { label: "Check criteria", tone: "warn" };
}

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent("/dashboard")}`);

  const data = await getDashboardData(session.user.id);

  // A signed-in account with no confirmed fact has nothing honest to show. Send
  // it back to the one step that produces them instead of an empty dashboard.
  if (data.factsCount === 0) {
    const path = data.candidate.student ? "new-grad" : "experienced";
    redirect(`/onboarding/resume?path=${path}&new=1`);
  }

  const firstName = data.displayName || session.user.name?.trim().split(/\s+/)[0] || "there";

  const metrics = [
    {
      key: "new",
      label: "New matches",
      value: data.metrics.newMatches,
      hint: `Strong fits discovered in the last ${NEW_MATCH_DAYS} days`,
      href: "/jobs?view=for-you",
      action: "See matches",
    },
    {
      key: "saved",
      label: "Shortlisted",
      value: data.metrics.shortlisted,
      hint: "Roles you saved, not applied to",
      href: "/jobs?view=saved",
      action: "Open shortlist",
    },
    {
      key: "progress",
      label: "Applications in progress",
      value: data.metrics.inProgress,
      hint: "Prepared, filled or submit attempted",
      href: "/applications",
      action: "Open tracker",
    },
    {
      key: "followup",
      label: "Follow-ups due",
      value: data.metrics.followUps,
      hint: `No status change for ${FOLLOW_UP_DAYS}+ days`,
      href: "/applications",
      action: "Review",
    },
  ];

  return (
    <AppShell active="dashboard">
      <main className="onboarding-page">
        <section aria-labelledby="overview-title" className="onboarding-content onboarding-content-wide dash">
          <header className="dash-head">
            <div>
              <p className="section-kicker">Overview</p>
              <h1 id="overview-title">
                {greeting()}, {firstName}.
              </h1>
              <p className="dash-lede">Here is what needs your attention today.</p>
            </div>
            <div className="dash-actions">
              <Link className="onboarding-submit" href="/jobs">
                Find jobs <span aria-hidden="true">→</span>
              </Link>
              <Link className="intake-secondary" href="/jobs#import">
                Import a job
              </Link>
              <Link className="intake-secondary" href={`/onboarding/resume?path=${data.candidate.student ? "new-grad" : "experienced"}&new=1`}>
                Update resume
              </Link>
            </div>
          </header>

          <ul className="dash-metrics" aria-label="Your search at a glance">
            {metrics.map((metric) => (
              <li className={`dash-metric is-${metric.key}`} key={metric.key}>
                <span className="dash-metric-label">{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.hint}</p>
                <Link href={metric.href}>
                  {metric.action} <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="dash-grid">
            <div className="dash-col">
              <section aria-labelledby="dash-matches" className="dash-panel">
                <div className="dash-panel-head">
                  <div>
                    <p className="dash-eyebrow">For you</p>
                    <h2 id="dash-matches">Best matches right now</h2>
                  </div>
                  <Link className="dash-panel-link" href="/jobs?view=for-you">
                    View all {data.matchPool > 0 ? `(${data.matchPool})` : ""} <span aria-hidden="true">→</span>
                  </Link>
                </div>

                {data.matches.length === 0 ? (
                  <div className="dash-empty">
                    <p>
                      No role currently scores above your shortlist line. That is a real result, not a loading state —
                      the corpus is rebuilt from employer boards every fifteen minutes.
                    </p>
                    <div className="dash-empty-actions">
                      <Link className="intake-secondary" href="/jobs?view=all">Browse every posting</Link>
                      <Link className="intake-secondary" href="/profile">Check your profile</Link>
                    </div>
                  </div>
                ) : (
                  <ul className="dash-matches">
                    {data.matches.map((match) => {
                      const eligibility = eligibilityLabel(match);
                      return (
                        <li className="dash-match" key={match.id}>
                          <div className="dash-match-main">
                            <div className="dash-match-title">
                              <Link href={`/jobs/${match.board}/${match.externalId}`}>{match.title}</Link>
                              {match.tracked ? <span className="dash-tag is-muted">In your tracker</span> : null}
                              {match.saved ? <span className="dash-tag is-saved">Saved</span> : null}
                            </div>
                            <p className="dash-match-meta">
                              <b>{match.company}</b>
                              {match.location ? <span>· {match.location}</span> : null}
                              {match.department ? <span>· {match.department}</span> : null}
                              <span>· posted {match.postedAt ? day.format(match.postedAt) : day.format(match.firstSeenAt)}</span>
                            </p>
                            <div className="dash-chips">
                              {match.matched.map((skill) => (
                                <span className="dash-chip" key={skill}>✓ {skill}</span>
                              ))}
                              {match.missing.map((skill) => (
                                <span className="dash-chip is-missing" key={skill}>{skill}</span>
                              ))}
                              <span className={`dash-status is-${eligibility.tone}`}>{eligibility.label}</span>
                              {match.trust.risk === "high" ? (
                                <span className="dash-status is-bad">Posting warning</span>
                              ) : match.trust.risk === "medium" ? (
                                <span className="dash-status is-warn">Worth a look</span>
                              ) : null}
                            </div>
                            {match.reasons.length > 0 ? (
                              <p className="dash-why">{match.reasons.slice(0, 2).join(" · ")}</p>
                            ) : null}
                            {match.trust.risk !== "low" && match.trust.flags.length > 0 ? (
                              <p className="dash-flag">⚠ {match.trust.flags[0]?.detail}</p>
                            ) : null}
                          </div>

                            <div className="dash-match-side">
                              <MatchDonut score={match.score} verdict={match.verdict} />
                            <div className="dash-match-actions">
                              <Link className="dash-action" href={`/jobs/${match.board}/${match.externalId}`}>
                                View match
                              </Link>
                              <form action={setJobDecision}>
                                <input name="postingId" type="hidden" value={match.id} />
                                <input name="board" type="hidden" value={match.board} />
                                <input name="title" type="hidden" value={match.title} />
                                <input name="company" type="hidden" value={match.company} />
                                <input name="location" type="hidden" value={match.location ?? ""} />
                                <input name="url" type="hidden" value={match.url} />
                                <input name="returnTo" type="hidden" value="/dashboard" />
                                <button
                                  className={`dash-action${match.saved ? " is-on" : ""}`}
                                  name="decision"
                                  type="submit"
                                  value={match.saved ? "clear" : "saved"}
                                >
                                  {match.saved ? "Saved" : "Save"}
                                </button>
                              </form>
                              <form action={setJobDecision}>
                                <input name="postingId" type="hidden" value={match.id} />
                                <input name="board" type="hidden" value={match.board} />
                                <input name="title" type="hidden" value={match.title} />
                                <input name="company" type="hidden" value={match.company} />
                                <input name="location" type="hidden" value={match.location ?? ""} />
                                <input name="url" type="hidden" value={match.url} />
                                <input name="returnTo" type="hidden" value="/dashboard" />
                                <button className="dash-action" name="decision" type="submit" value="dismissed">
                                  Dismiss
                                </button>
                              </form>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="dash-fineprint">
                  A score is a reading aid built from named skills, title, years asked, location and freshness. It is not a
                  hiring probability.
                </p>
              </section>

              <section aria-labelledby="dash-attention" className="dash-panel">
                <div className="dash-panel-head">
                  <div>
                    <p className="dash-eyebrow">Today</p>
                    <h2 id="dash-attention">Needs your attention</h2>
                  </div>
                  <span className="dash-panel-count">{data.attention.length}</span>
                </div>
                {data.attention.length === 0 ? (
                  <p className="dash-empty-line">
                    Nothing is waiting: profile areas are confirmed, no application is overdue, and the last scan is
                    healthy.
                  </p>
                ) : (
                  <ul className="dash-attention">
                    {data.attention.map((item) => (
                      <li className={`is-${item.tone}`} key={item.title}>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </div>
                        <Link href={item.href}>{item.action} <span aria-hidden="true">→</span></Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside className="dash-aside">
              <section aria-labelledby="dash-pipeline" className="dash-panel">
                <div className="dash-panel-head">
                  <div>
                    <p className="dash-eyebrow">Pipeline</p>
                    <h2 id="dash-pipeline">Where each application is</h2>
                  </div>
                </div>
                <ul className="dash-pipeline">
                  {data.pipeline.map((stage) => (
                    <li key={stage.key}>
                      <Link href="/applications">
                        <span className={`dash-dot is-${stage.key}`} aria-hidden="true" />
                        <span className="dash-stage">{stage.label}</span>
                        <span className="dash-stage-hint">{stage.hint}</span>
                        <b>{stage.count}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="dash-fineprint">
                  “Submit attempted” means you pressed submit. “Receipt confirmed” means the employer confirmed it — the
                  two are never merged.
                </p>
              </section>

              <section aria-labelledby="dash-readiness" className="dash-panel">
                <div className="dash-panel-head">
                  <div>
                    <p className="dash-eyebrow">Profile</p>
                    <h2 id="dash-readiness">Ready for the next form?</h2>
                  </div>
                </div>
                <div className="dash-progress" aria-hidden="true">
                  <span style={{ width: `${data.readiness.percent}%` }} />
                </div>
                <p className="dash-progress-label">
                  {data.readiness.headline} · {data.readiness.formDetailsFilled} form details set
                </p>
                {data.readiness.missing.length > 0 ? (
                  <p className="dash-missing">Still empty: {data.readiness.missing.join(", ")}.</p>
                ) : (
                  <p className="dash-missing is-ok">Every profile area has a confirmed fact.</p>
                )}
                {data.readiness.formDetailsMissing > 0 ? (
                  <p className="dash-missing">
                    {data.readiness.formDetailsMissing} form {data.readiness.formDetailsMissing === 1 ? "answer" : "answers"} unset —
                    they stay blank on employer forms rather than being guessed.
                  </p>
                ) : null}
                <div className="dash-readiness-actions">
                  <Link className="intake-secondary" href="/profile">Open profile</Link>
                  <Link className="intake-secondary" href="/jobs">See answers</Link>
                </div>
              </section>

              <section aria-labelledby="dash-scan" className="dash-panel">
                <div className="dash-panel-head">
                  <div>
                    <p className="dash-eyebrow">Sources</p>
                    <h2 id="dash-scan">Scanner health</h2>
                  </div>
                </div>
                <dl className="dash-scan">
                  <div>
                    <dt>Last checked</dt>
                    <dd>{data.scan.at ? `${dayTime.format(data.scan.at)} (${ago(data.scan.at)})` : "never"}</dd>
                  </div>
                  <div>
                    <dt>Sources configured</dt>
                    <dd>{data.scan.boardsConfigured}</dd>
                  </div>
                  <div>
                    <dt>Postings seen last scan</dt>
                    <dd>{data.scan.seen}</dd>
                  </div>
                </dl>
                {data.scan.errors.length > 0 ? (
                  <p className="dash-scan-error">
                    Last scan reported failures: {data.scan.errors.slice(0, 3).join("; ")}. Stored jobs stay available.
                  </p>
                ) : data.scan.stale ? (
                  <p className="dash-scan-note">
                    The corpus is older than {SCAN_STALE_MINUTES} minutes. New postings will not appear until the worker
                    runs again.
                  </p>
                ) : (
                  <p className="dash-scan-note">No source errors were recorded for the last completed scan.</p>
                )}
                <Link className="intake-secondary" href="/jobs">Browse the corpus</Link>
              </section>
            </aside>
          </div>

          <section aria-labelledby="dash-activity" className="dash-panel dash-activity-panel">
            <div className="dash-panel-head">
              <div>
                <p className="dash-eyebrow">History</p>
                <h2 id="dash-activity">Recent activity</h2>
              </div>
            </div>
            {data.activity.length === 0 ? (
              <p className="dash-empty-line">
                Nothing recorded yet. Saving a job, generating a document or changing an application status appears here.
              </p>
            ) : (
              <ol className="dash-activity">
                {data.activity.map((item) => (
                  <li key={item.id}>
                    <span className={`dash-activity-kind is-${item.kind}`} aria-hidden="true" />
                    <div>
                      <Link href={item.href}>{item.title}</Link>
                      <p>{item.detail}</p>
                    </div>
                    <time dateTime={item.at.toISOString()}>{ago(item.at)}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </section>
      </main>
    </AppShell>
  );
}
