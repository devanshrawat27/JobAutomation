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
    <div className="wiz-shell">
      <aside className="wiz-aside" aria-hidden="true">
        <span className="wiz-aside-glyph">01</span>
        <div className="wiz-aside-top">
          <p className="wiz-aside-kicker">Your starting point</p>
          <p className="wiz-aside-line">let&rsquo;s begin.</p>
        </div>
        <div className="wiz-aside-foot">
          <div className="wiz-track-bar"><i style={{ width: "12.5%" }} /></div>
          <p className="wiz-aside-note">8 short steps · stop and return whenever you like</p>
        </div>
      </aside>

      <section className="wiz-main" aria-labelledby="onboarding-title">
        <p className="wiz-main-kicker">Step 1 of 8</p>
        <h1 id="onboarding-title">{continued ? "Starting point selected." : "Where are you in your career?"}</h1>
        <p className="onboarding-intro">
          {continued
            ? "Next, add a resume and review every profile detail suggested from it. You can correct or skip any suggestion."
            : "Choose the starting point that fits today. It only decides which questions we ask first — every path ends with the same reviewable profile."}
        </p>

        {hasProfile ? (
          <div className="wiz-fineprint">
            You already have {factCount} confirmed {factCount === 1 ? "detail" : "details"} on this account. Picking a path
            only changes which questions we suggest next.
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

            <div className="wiz-nav">
              <Link className="wiz-back" href="/">← Home</Link>
              <button className="wiz-next" type="submit" disabled={!selectedPath}>
                Continue <span aria-hidden="true">→</span>
              </button>
            </div>
            <p className="wiz-skip">
              <span>You can change this later. Your history can include education, internships and professional work.</span>
            </p>
          </form>
        ) : (
          <div className="wiz-brief" role="status" aria-live="polite">
            <h2 className="path-confirm-title">{paths[selectedPath as CandidatePath].label}</h2>
            <div className="wiz-nav">
              <button className="wiz-back" onClick={() => setContinued(false)} type="button">← Change</button>
              <Link className="wiz-next" href={`/onboarding/resume?path=${selectedPath}`}>
                Add your resume <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        )}

        <p className="wiz-fineprint">
          Your facts stay yours. You review what gets used, and nothing is sent to an employer without you.
        </p>
      </section>
    </div>
  );
}
