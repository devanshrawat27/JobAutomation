"use client";

import Link from "next/link";
import { useState } from "react";

export type ApplicationStepsData = {
  company: string;
  role: string;
  counts: { match: number; partial: number; gap: number; unknown: number } | null;
  total: number;
  eligibility: { verdict: string; reasons: string[] } | null;
  trust: { risk: string; flags: Array<{ label: string; detail: string }> } | null;
  resume: { id: string; kind: string } | null;
  letter: { id: string } | null;
  answersReady: number;
  answersMissing: number;
  prepareHref: string;
  answersHref: string;
  employerUrl: string;
  tracked: boolean;
};

const STEPS = [
  { number: 1, label: "Check the fit" },
  { number: 2, label: "Prepare documents" },
  { number: 3, label: "Answers & apply" },
];

export default function ApplicationSteps({ data }: { data: ApplicationStepsData }) {
  const [step, setStep] = useState(1);

  return (
    <section aria-labelledby="steps-title" className="app-steps">
      <div className="app-steps-head">
        <div>
          <h2 id="steps-title">Your application</h2>
          <p>Three steps. You open the employer’s form and submit it yourself.</p>
        </div>
        <span>{data.tracked ? "Tracked" : "Not submitted"}</span>
      </div>

      <ol className="app-steps-tabs">
        {STEPS.map((entry) => (
          <li
            className={step === entry.number ? "is-active" : step > entry.number ? "is-done" : ""}
            key={entry.number}
          >
            <button onClick={() => setStep(entry.number as 1 | 2 | 3)} type="button">
              <span>{entry.number}</span>
              {entry.label}
            </button>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="app-step-panel">
          <div className="app-step-fit">
            <div>
              <strong>
                {data.counts && data.total > 0
                  ? `${data.counts.match} of ${data.total} requirements clearly met`
                  : "This posting states no requirements we can compare"}
              </strong>
              <p>
                {data.counts && data.total > 0
                  ? `${data.counts.gap} look like gaps, ${data.counts.unknown} need checking.`
                  : "Read the posting itself before deciding. Nothing is assumed."}
              </p>
              <a className="app-step-link" href="#match-title">
                Read every requirement ↓
              </a>
            </div>
          </div>

          <ul className="app-step-facts">
            <li>
              <span>Eligibility</span>
              <strong>
                {data.eligibility
                  ? data.eligibility.verdict === "eligible"
                    ? "You meet the stated criteria"
                    : data.eligibility.verdict === "not-eligible"
                      ? "You do not meet the stated criteria"
                      : "Some criteria need checking"
                  : "Posting states no criteria"}
              </strong>
            </li>
            <li>
              <span>Posting check</span>
              <strong>
                {data.trust?.risk === "high"
                  ? "Flagged — read before applying"
                  : data.trust?.risk === "medium"
                    ? "Worth a second look"
                    : "No risk flags"}
              </strong>
            </li>
          </ul>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="app-step-panel">
          <ul className="app-step-doclist">
            <li className={data.resume ? "is-done" : ""}>
              <div>
                <strong>Tailored resume</strong>
                <p>
                  {data.resume
                    ? "Ready for this posting, cited to your facts."
                    : "Not built yet. The draft uses only facts you confirmed."}
                </p>
              </div>
              {data.resume ? (
                <Link href={`/documents/${data.resume.id}`}>Open</Link>
              ) : (
                <Link href={data.prepareHref}>Build</Link>
              )}
            </li>
            <li className={data.letter ? "is-done" : ""}>
              <div>
                <strong>Cover letter</strong>
                <p>{data.letter ? "A letter for this posting is ready." : "Optional; build one from the same facts."}</p>
              </div>
              {data.letter ? (
                <Link href={`/documents/${data.letter.id}`}>Open</Link>
              ) : (
                <Link href={data.prepareHref}>Build</Link>
              )}
            </li>
          </ul>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="app-step-panel">
          <div className="app-step-answers">
            <div>
              <strong>
                {data.answersReady} answer{data.answersReady === 1 ? "" : "s"} ready · {data.answersMissing} missing
              </strong>
              <p>Missing answers stay blank on the form. They are never guessed.</p>
            </div>
            <Link href={data.answersHref}>Open answers</Link>
          </div>

          <div className="app-step-apply">
            <div>
              <strong>Apply on the employer’s site</strong>
              <p>Check the form, attach the resume, press submit. Nothing is sent from here.</p>
            </div>
            <a href={data.employerUrl} rel="noreferrer noopener" target="_blank">
              Open form ↗
            </a>
          </div>
        </div>
      ) : null}

      <div className="app-step-foot">
        <button
          className="intake-secondary"
          disabled={step === 1}
          onClick={() => setStep((current) => Math.max(1, current - 1) as 1 | 2 | 3)}
          type="button"
        >
          Back
        </button>
        <span>
          Step {step} of 3
        </span>
        {step < 3 ? (
          <button
            className="onboarding-submit"
            onClick={() => setStep((current) => Math.min(3, current + 1) as 1 | 2 | 3)}
            type="button"
          >
            Next <span aria-hidden="true">→</span>
          </button>
        ) : (
          <a className="onboarding-submit" href={data.employerUrl} rel="noreferrer noopener" target="_blank">
            Open employer form ↗
          </a>
        )}
      </div>
    </section>
  );
}
