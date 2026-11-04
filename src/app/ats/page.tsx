import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";
import AtsScanner from "./ats-scanner";

export const dynamic = "force-dynamic";

export const metadata = { title: "ATS scan — JobAutomation" };

export default async function AtsPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent("/ats")}`);

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href="/documents">← Documents</Link>
        </span>
      </header>

      <section aria-labelledby="ats-page-title" className="onboarding-content">
        <p className="section-kicker">Resume check</p>
        <h1 id="ats-page-title">See it the way an ATS does.</h1>
        <p className="onboarding-intro">
          Upload a resume, name the role, and get a deterministic read: contact details, sections, dates, quantified
          bullets, verb openers, length and keyword coverage. Every point is a rule, not an opinion.
        </p>

        <AtsScanner />
      </section>

      <footer className="onboarding-footer">
        <Link href="/documents">← Documents</Link>
        <span>The file is read in memory and discarded.</span>
      </footer>
    </main>
  );
}
