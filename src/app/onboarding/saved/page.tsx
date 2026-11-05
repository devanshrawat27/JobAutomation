import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profile saved — JobAutomation" };

function number(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

type Search = {
  merge?: string | string[];
  added?: string | string[];
  updated?: string | string[];
  kept?: string | string[];
  skipped?: string | string[];
  na?: string | string[];
};

export default async function SavedPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect(`/sign-in?next=${encodeURIComponent("/onboarding/saved")}`);
  }

  const params = await searchParams;
  const merge = (Array.isArray(params.merge) ? params.merge[0] : params.merge) === "1";
  const counts = merge
    ? [
        { label: "Added", value: number(params.added) },
        { label: "Updated", value: number(params.updated) },
        { label: "Unchanged", value: number(params.kept) },
      ]
    : [
        { label: "Kept", value: number(params.kept) },
        { label: "Skipped", value: number(params.skipped) },
        { label: "Not applicable", value: number(params.na) },
      ];
  const kept = number(params.kept);

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">About 3 minutes left</span>
      </header>

      <div className="wiz-shell">
        <aside className="wiz-aside" aria-hidden="true">
          <span className="wiz-aside-glyph">02</span>
          <div className="wiz-aside-top">
            <p className="wiz-aside-kicker">Your resume</p>
            <p className="wiz-aside-line">that is on the record.</p>
          </div>
          <div className="wiz-aside-foot">
            <div className="wiz-track-bar"><i style={{ width: "100%" }} /></div>
            <p className="wiz-aside-note">Confirmed facts only · nothing else was kept</p>
          </div>
        </aside>

        <section className="wiz-main" aria-labelledby="saved-title">
          <p className="wiz-main-kicker">Step 2 of 8 · done</p>
          <h1 id="saved-title">{merge ? "Your profile is up to date." : `${kept} ${kept === 1 ? "detail is" : "details are"} ready to reuse`}</h1>
          <p className="onboarding-intro">
            {merge
              ? "Your earlier details are still there. This upload only added or refreshed what you confirmed — nothing was deleted."
              : "These are the facts a job application would draw on. Everything else stays out of your profile and can still be answered per application."}
          </p>

          <dl className="review-done-counts">
            {counts.map((count) => (
              <div key={count.label}>
                <dt>{count.label}</dt>
                <dd>{count.value}</dd>
              </div>
            ))}
          </dl>

          <div className="wiz-nav">
            <Link className="wiz-back" href="/onboarding/resume?new=1">
              <span aria-hidden="true">↺</span> Upload another
            </Link>
            <Link className="wiz-next" href="/onboarding/preferences">
              Set job preferences <span aria-hidden="true">→</span>
            </Link>
          </div>

          <p className="wiz-skip">
            <Link href="/dashboard">Skip to your overview</Link>
            <span>·</span>
            <span>You can add a newer resume later.</span>
          </p>

          <p className="wiz-fineprint">
            Saved to your account. Job matching, document drafts and form answers all read these confirmed facts — nothing
            reaches an employer until you submit it yourself.
          </p>
        </section>
      </div>

      <footer className="onboarding-footer">
        <Link href="/profile">← Your profile</Link>
        <span>Every detail here can be edited or deleted later.</span>
      </footer>
    </main>
  );
}
