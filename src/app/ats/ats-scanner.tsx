"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Check = { id: string; label: string; status: string; detail: string; points: number; max: number };
type Report = { score: number; grade: string; summary: string; checks: Check[] };

export default function AtsScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  async function scan() {
    if (!file) return;
    setStep(3);
    setError("");

    const body = new FormData();
    body.set("resume", file);
    body.set("role", role);

    try {
      const response = await fetch("/api/ats", { method: "POST", body });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error ?? "The scan failed. Try again.");
        setStep(2);
        return;
      }
      setReport(data.report as Report);
    } catch {
      setError("The scan failed. Check your connection and try again.");
      setStep(2);
    }
  }

  function reset() {
    setFile(null);
    setRole("");
    setStep(1);
    setReport(null);
    setError("");
  }

  if (report) {
    return (
      <div className="ats-scanner">
        <div className="ats-result-head">
          <div>
            <p className="section-kicker">ATS scan</p>
            <h2>
              {report.grade === "strong" ? "Strong." : report.grade === "fair" ? "Fair." : "Needs a look."}
            </h2>
            <p>{report.summary}</p>
          </div>
          <span className={`doc-ats-score is-${report.grade}`}>
            {report.score}
            <small>/100</small>
          </span>
        </div>

        <ul className="doc-ats-checks">
          {report.checks.map((check) => (
            <li className={`is-${check.status}`} key={check.id}>
              <span aria-hidden="true" className="doc-ats-state">
                {check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "×"}
              </span>
              <div>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </div>
              <span className="doc-ats-points">
                {check.points}/{check.max}
              </span>
            </li>
          ))}
        </ul>

        <div className="ats-actions">
          <button className="intake-secondary" onClick={reset} type="button">
            Scan another resume
          </button>
          <Link className="intake-secondary" href="/documents">
            Back to documents
          </Link>
        </div>
        <p className="jobs-note">
          The file was read in memory and discarded. Nothing was stored, and this scan is not attached to your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="ats-scanner">
      <ol className="ats-steps" aria-label="Scan steps">
        {[["1", "Resume"], ["2", "Target"], ["3", "Analyze"]].map(([number, label], index) => (
          <li className={step === index + 1 ? "is-active" : step > index + 1 ? "is-done" : ""} key={number}>
            <span>{number}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="ats-panel">
          <h2>Pick the resume to scan</h2>
          <p>Upload a PDF or DOCX. It is read once, in memory, and discarded — nothing is stored.</p>
          <label className="ats-drop">
            <input
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                setFile(picked);
                if (picked) setStep(2);
              }}
              ref={input}
              type="file"
            />
            {file ? (
              <>
                <strong>{file.name}</strong>
                <small>{Math.round(file.size / 1024)} KB · click to replace</small>
              </>
            ) : (
              <>
                <strong>Choose a PDF or DOCX</strong>
                <small>Drag it here, or click to browse · max 10 MB</small>
              </>
            )}
          </label>
          <div className="ats-actions">
            <button className="onboarding-submit" disabled={!file} onClick={() => setStep(2)} type="button">
              Next <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="ats-panel">
          <h2>What role is it for?</h2>
          <p>Optional, but it makes the keyword check useful. Write the role the way a posting would.</p>
          <label className="jobs-field">
            <span>Target role</span>
            <input
              onChange={(event) => setRole(event.target.value)}
              placeholder="e.g. Backend Engineer"
              type="text"
              value={role}
            />
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <div className="ats-actions">
            <button className="intake-secondary" onClick={() => setStep(1)} type="button">
              Back
            </button>
            <button className="onboarding-submit" onClick={scan} type="button">
              Scan this resume <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="ats-panel ats-analyzing">
          <span aria-hidden="true" className="ats-spinner" />
          <h2>Reading the resume the way a parser would…</h2>
          <p>Structure, contact details, dates, numbers and the role’s keywords.</p>
        </div>
      ) : null}
    </div>
  );
}
