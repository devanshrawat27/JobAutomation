"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type CandidatePath = "new-grad" | "experienced";

const paths: Record<CandidatePath, { label: string; description: string; details: string[] }> = {
  "new-grad": {
    label: "New Grad / Fresher",
    description: "I’m studying, recently graduated, or starting my career.",
    details: ["Education and graduation timeline", "Projects, internships, and skills"],
  },
  experienced: {
    label: "Experienced professional",
    description: "I have professional work experience and want to plan my next move.",
    details: ["Roles, achievements, and career history", "Availability and job preferences"],
  },
};

export default function OnboardingForm({
  initialPath,
  factCount,
}: {
  initialPath: CandidatePath | "";
  factCount: number;
}) {
  const [selectedPath, setSelectedPath] = useState<CandidatePath | "">(initialPath);
  const [continued, setContinued] = useState(false);
  const hasProfile = factCount > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedPath) setContinued(true);
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link className="brand" href="/" aria-label="JobAutomation home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">Step 1 of 8 <span aria-hidden="true">·</span> about a minute</span>
      </header>
      <div className="onboarding-progress" aria-hidden="true"><i style={{ width: "12.5%" }} /></div>

      <section className="onboarding-content" aria-labelledby="onboarding-title">
        <p className="section-kicker">A profile shaped around you</p>
        <h1 id="onboarding-title">Where are you in your career?</h1>
        <p className="onboarding-intro">
          Choose the starting point that fits today. We’ll use it to prioritize the profile details that matter to you.
        </p>

        {hasProfile ? (
          <div className="profile-exists">
            <p>
              <strong>You already have a profile</strong> — {factCount} confirmed {factCount === 1 ? "detail" : "details"}.
              Picking a path only changes which questions we suggest next.
            </p>
            <div className="profile-exists-actions">
              <Link className="onboarding-submit" href="/profile">
                Open my profile <span aria-hidden="true">→</span>
              </Link>
              <Link className="intake-secondary" href="/jobs">Find jobs</Link>
            </div>
          </div>
        ) : null}

        {!continued ? (
          <form className="path-form" onSubmit={handleSubmit}>
            <fieldset className="path-options">
              <legend className="sr-only">Choose your career stage</legend>
              {(Object.entries(paths) as [CandidatePath, (typeof paths)[CandidatePath]][]).map(([value, path]) => (
                <label className={`onboarding-choice${selectedPath === value ? " is-selected" : ""}`} key={value}>
                  <input
                    className="choice-radio"
                    type="radio"
                    name="candidate-path"
                    value={value}
                    checked={selectedPath === value}
                    onChange={() => setSelectedPath(value)}
                  />
                  <span className="choice-copy">
                    <span className="choice-title">{path.label}</span>
                    <span className="choice-description">{path.description}</span>
                    <span className="choice-details">
                      {path.details.map((detail) => <span key={detail}>{detail}</span>)}
                    </span>
                  </span>
                  <span className="choice-arrow" aria-hidden="true">↗</span>
                </label>
              ))}
            </fieldset>

            <div className="path-form-footer">
              <p>You can change this later. Your career history can include education, internships, and professional work.</p>
              <button className="onboarding-submit" type="submit" disabled={!selectedPath}>
                Continue <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="path-confirmation" role="status" aria-live="polite">
            <span className="confirmation-mark" aria-hidden="true">✓</span>
            <div>
              <p className="confirmation-kicker">Starting point selected</p>
              <h2>{paths[selectedPath as CandidatePath].label}</h2>
              <p className="confirmation-copy">
                Next, you’ll add a resume and review the profile details suggested from it. You’ll be able to correct or skip any suggestion.
              </p>
              <div className="confirmation-actions">
                <Link className="onboarding-submit" href={`/onboarding/resume?path=${selectedPath}`}>
                  Add your resume <span aria-hidden="true">→</span>
                </Link>
                <button className="text-button" type="button" onClick={() => setContinued(false)}>
                  Change my selection
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="onboarding-footer">
        <Link href="/">← Back to home</Link>
        <span>Your facts stay yours. You review what gets used.</span>
      </footer>
    </main>
  );
}
