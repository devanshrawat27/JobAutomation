import Link from "next/link";

import { aiExtractionEnabled } from "@/lib/ai/gemini";
import { prisma } from "@/lib/db";
import type { CandidatePath } from "@/lib/profile-facts";
import { getCurrentSession } from "@/lib/session";
import ResumeIntake from "./resume-intake";

type ResumeSearchParams = {
  path?: string | string[];
  step?: string | string[];
  new?: string | string[];
};

function isCandidatePath(value: string | string[] | undefined): value is CandidatePath {
  return value === "new-grad" || value === "experienced";
}

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ResumeIntakePage({
  searchParams,
}: {
  searchParams: Promise<ResumeSearchParams>;
}) {
  const { path, step, new: startNew } = await searchParams;
  const session = await getCurrentSession();
  const candidatePath = isCandidatePath(path) ? path : "";

  const facts = session?.user
    ? await prisma.profileFact.findMany({
        where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
        orderBy: [{ position: "asc" }],
        select: { id: true, key: true, groupId: true, label: true, value: true },
      })
    : [];

  // A saved profile should not meet a blank upload box again.
  if (session?.user && facts.length > 0 && pick(startNew) !== "1") {
    return (
      <main className="onboarding-page">
        <header className="onboarding-header">
          <Link aria-label="JobAutomation home" className="brand" href="/">
            <span aria-hidden="true" className="brand-mark"><span /></span>
            <span>jobautomation</span>
          </Link>
          <span className="onboarding-step">Step 2 of 8 · Profile ready</span>
        </header>

        <div className="wiz-shell">
          <aside className="wiz-aside" aria-hidden="true">
            <span className="wiz-aside-glyph">02</span>
            <div className="wiz-aside-top">
              <p className="wiz-aside-kicker">Your resume</p>
              <p className="wiz-aside-line">already on the record.</p>
            </div>
            <div className="wiz-aside-foot">
              <div className="wiz-track-bar"><i style={{ width: "25%" }} /></div>
              <p className="wiz-aside-note">No upload needed · every detail can still be edited</p>
            </div>
          </aside>

          <section className="wiz-main" aria-labelledby="ready-title">
            <p className="wiz-main-kicker">Step 2 of 8 · done</p>
            <h1 id="ready-title">Your profile is already saved.</h1>
            <p className="onboarding-intro">
              {facts.length} confirmed {facts.length === 1 ? "detail is" : "details are"} on this account — across{" "}
              {new Set(facts.map((fact) => fact.groupId)).size} groups. You do not need to upload the resume again.
            </p>

            <div className="wiz-nav">
              <Link className="wiz-back" href="/profile">
                <span aria-hidden="true">←</span> Open my profile
              </Link>
              <Link className="wiz-next" href="/onboarding/preferences">
                Set job preferences <span aria-hidden="true">→</span>
              </Link>
            </div>

            <p className="wiz-skip">
              <Link href="/jobs">Find jobs</Link>
              <span>·</span>
              <span>
                Want a newer resume?{" "}
                <Link href={`/onboarding/resume?path=${candidatePath || "new-grad"}&new=1`}>Upload a new version</Link> — you
                review every change first.
              </span>
            </p>
          </section>
        </div>

        <footer className="onboarding-footer">
          <Link href="/profile">← Your profile</Link>
          <span>Your facts stay yours. You review what gets used.</span>
        </footer>
      </main>
    );
  }

  return (
    <ResumeIntake
      aiEnabled={aiExtractionEnabled()}
      existingFacts={facts.map((fact) => ({
        id: fact.id,
        key: fact.key,
        groupId: fact.groupId,
        label: fact.label,
        value: fact.value,
      }))}
      initialPath={candidatePath}
      initialPhase={step === "review" ? "review" : "intake"}
      signedIn={Boolean(session?.user)}
    />
  );
}
