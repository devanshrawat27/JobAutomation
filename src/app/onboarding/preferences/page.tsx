import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { savePreferences } from "@/app/actions/preferences";

export const dynamic = "force-dynamic";

export const metadata = { title: "Job preferences — JobAutomation" };

export default async function PreferencesPage() {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect(`/sign-in?next=${encodeURIComponent("/onboarding/preferences")}`);
  }

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id },
    select: { groupId: true, key: true, value: true, status: true },
  });
  const confirmed = facts.filter((fact) => fact.status === "CONFIRMED" || fact.status === "EDITED");

  if (confirmed.length === 0) redirect("/onboarding");

  const pref = new Map<string, string>();
  for (const fact of facts) {
    if (fact.key.startsWith("preferences.")) pref.set(fact.key, fact.value);
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">Step 3 of 3 <span aria-hidden="true">·</span> about a minute</span>
      </header>
      <div className="onboarding-progress" aria-hidden="true"><i style={{ width: "100%" }} /></div>

      <section aria-labelledby="prefs-title" className="onboarding-content">
        <p className="section-kicker">Job preferences</p>
        <h1 id="prefs-title">What should the matcher aim at?</h1>
        <p className="onboarding-intro">
          These are yours, not guesses. They filter and rank the feed; you can change them any time from your profile.
          Leave anything blank and it will not be used.
        </p>

        <form action={savePreferences} className="prefs-form">
          <label className="jobs-field prefs-wide">
            <span>Target roles (up to 3)</span>
            <input
              defaultValue={pref.get("preferences.targetRoles") ?? ""}
              name="roles"
              placeholder="Backend Engineer, Platform Engineer"
              type="text"
            />
          </label>

          <label className="jobs-field">
            <span>Preferred locations</span>
            <input
              defaultValue={pref.get("preferences.locations") ?? ""}
              name="locations"
              placeholder="Bengaluru, Pune, Remote"
              type="text"
            />
          </label>

          <label className="jobs-field">
            <span>Work mode</span>
            <select defaultValue={pref.get("preferences.workMode") ?? ""} name="mode">
              <option value="">Any mode</option>
              <option value="onsite">On-site</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
            </select>
          </label>

          <label className="jobs-field">
            <span>Minimum salary (LPA)</span>
            <input
              defaultValue={pref.get("preferences.minSalary") ?? ""}
              min={0}
              name="salary"
              placeholder="e.g. 8"
              step="0.5"
              type="number"
            />
          </label>

          <label className="jobs-field prefs-wide">
            <span>Companies or words to avoid</span>
            <input
              defaultValue={pref.get("preferences.exclude") ?? ""}
              name="exclude"
              placeholder="Staffing agencies, a company name, a keyword"
              type="text"
            />
          </label>

          <div className="prefs-actions">
            <button className="onboarding-submit" type="submit">
              Save and see jobs <span aria-hidden="true">→</span>
            </button>
            <Link className="intake-secondary" href="/dashboard">
              Skip for now
            </Link>
          </div>
        </form>

        <p className="intake-privacy">
          These preferences live on your account like any other confirmed fact. They only change what this workspace shows
          you — nothing is shared with an employer.
        </p>
      </section>

      <footer className="onboarding-footer">
        <Link href="/dashboard">← Your overview</Link>
        <span>Change these later on your profile.</span>
      </footer>
    </main>
  );
}
