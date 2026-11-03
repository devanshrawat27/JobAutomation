import Link from "next/link";

import AppShell from "@/components/app-shell";
import { redirect } from "next/navigation";

import { factGroups, type FactGroupId } from "@/lib/profile-facts";
import { prisma } from "@/lib/db";
import { saveFormDetail } from "@/app/actions/form-detail";
import { buildAnswers } from "@/lib/form/answers";
import { buildCandidate } from "@/lib/jobs/match";
import { getCurrentSession } from "@/lib/session";
import ProfileActions from "./profile-actions";
import ProfileFactRow from "./profile-fact-row";

export const dynamic = "force-dynamic";

function groupTitle(id: string): string {
  return factGroups[id as FactGroupId]?.title ?? id;
}

const groupOrder: FactGroupId[] = ["contact", "education", "experience", "projects", "skills"];

function groupRank(id: string): number {
  const index = groupOrder.indexOf(id as FactGroupId);
  return index === -1 ? groupOrder.length : index;
}

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect(`/sign-in?next=${encodeURIComponent("/profile")}`);
  }

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id },
    orderBy: [{ position: "asc" }],
  });

  const kept = facts.filter((fact) => fact.status === "CONFIRMED" || fact.status === "EDITED").length;
  const skipped = facts.filter((fact) => fact.status === "SKIPPED").length;
  const notApplicable = facts.filter((fact) => fact.status === "NOT_APPLICABLE").length;

  const nameFact = facts.find((fact) => /full name|^name$/i.test(fact.label));
  const locationFact = facts.find((fact) => /city|location|based/i.test(fact.label));
  const candidate = buildCandidate(
    facts.map((fact) => ({ label: fact.label, value: fact.value, group: fact.groupId })),
  );
  const headline = candidate.student
    ? `Student${candidate.graduationYear ? ` · class of ${candidate.graduationYear}` : ""}`
    : candidate.years > 0
      ? `${candidate.years} years · ${candidate.family ?? "profile"}`
      : "No dated experience yet";

  // The questions employer forms ask that a resume never answers.
  const formAnswers = buildAnswers(
    facts.map((fact) => ({ key: fact.key, label: fact.label, value: fact.value })),
  ).filter((answer) => !answer.value);

  const groupIds = [...new Set(facts.map((fact) => fact.groupId))].sort(
    (left, right) => groupRank(left) - groupRank(right),
  );

  return (
    <AppShell active="profile">
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">Your profile</span>
      </header>

      <section aria-labelledby="profile-title" className="onboarding-content onboarding-content-wide">
        <div className="profile-head">
          <span aria-hidden="true" className="profile-avatar">
            {nameFact
              ? nameFact.value
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("")
              : "JA"}
          </span>
          <div className="profile-head-body">
            <p className="section-kicker">Your verified profile</p>
            <h1 id="profile-title">{nameFact?.value ?? "Your profile"}</h1>
            <p className="profile-headline">
              {headline}
              {locationFact ? ` · ${locationFact.value}` : ""}
            </p>
            <p className="profile-head-meta">
              {kept} confirmed facts
              {candidate.skills.length > 0 ? ` · ${candidate.skills.length} skills` : ""}
            </p>
          </div>
        </div>

        <div className="profile-links">
          <Link className="intake-secondary" href="/jobs">
            Find jobs <span aria-hidden="true">↗</span>
          </Link>
          <Link className="intake-secondary" href="/documents">
            Documents <span aria-hidden="true">↗</span>
          </Link>
          <Link className="intake-secondary" href="/applications">
            Applications <span aria-hidden="true">↗</span>
          </Link>
        </div>

        {formAnswers.length > 0 ? (
          <details className="profile-form-details" open={facts.length > 0}>
            <summary>
              Still needed for forms <span>{formAnswers.length}</span>
            </summary>
            <p>
              Employer forms ask these more often than a resume states them. Fill what applies once; the extension and the
              answer sheet reuse it, and nothing is guessed.
            </p>
            <div className="profile-form-list">
              {formAnswers.slice(0, 8).map((answer) => (
                <form action={saveFormDetail} className="profile-form-row" key={answer.id}>
                  <input name="id" type="hidden" value={answer.id} />
                  <input name="label" type="hidden" value={answer.label} />
                  <input name="group" type="hidden" value={answer.group} />
                  <label>
                    <span>{answer.label}</span>
                    <input maxLength={300} name="value" placeholder={answer.note ? "Not stated on your resume" : ""} required />
                  </label>
                  <button type="submit">Save</button>
                </form>
              ))}
            </div>
          </details>
        ) : null}

        {facts.length === 0 ? (
          <div className="profile-empty">
            <p>No facts saved yet.</p>
            <Link className="intake-secondary" href="/onboarding">
              Start from your resume
            </Link>
          </div>
        ) : (
          <>
            <p className="profile-counts-line">
              {kept} kept
              {skipped > 0 ? ` · ${skipped} skipped` : ""}
              {notApplicable > 0 ? ` · ${notApplicable} not applicable` : ""}
            </p>

            <div className="review-groups">
              {groupIds.map((groupId) => {
                const groupFacts = facts.filter((fact) => fact.groupId === groupId);
                return (
                  <section aria-labelledby={`saved-${groupId}`} className="fact-group" key={groupId}>
                    <div className="fact-group-head">
                      <h2 id={`saved-${groupId}`}>{groupTitle(groupId)}</h2>
                      <span>{groupFacts.length} saved</span>
                    </div>
                    <div className="fact-list">
                      {groupFacts.map((fact) => (
                        <ProfileFactRow
                          fact={{
                            key: fact.key,
                            label: fact.label,
                            value: fact.value,
                            sourceText: fact.sourceText,
                            status: fact.status,
                          }}
                          key={fact.id}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        <ProfileActions hasFacts={facts.length > 0} />
      </section>

      <footer className="onboarding-footer">
        <Link href="/onboarding">← Back to onboarding</Link>
        <span>Your facts stay yours. You review what gets used.</span>
      </footer>
    </main>
    </AppShell>
  );
}
