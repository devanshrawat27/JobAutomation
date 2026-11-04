"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { saveProfileFacts } from "@/app/actions/profile";
import { extractResumeFacts } from "@/app/actions/resume";
import {
  confidenceLabels,
  countByStatus,
  factGroups,
  sampleExtractions,
  statusLabels,
  type CandidatePath,
  type FactStatus,
  type ProfileFact,
} from "@/lib/profile-facts";
import { factIdentity, normalizeFactValue } from "@/lib/resume/merge-profile";
import type { MergeExistingFact } from "@/lib/resume/merge-profile";
import type { ResumeProposal } from "@/lib/resume/propose-facts";

type Phase = "intake" | "review" | "done";
type Review = { status: FactStatus; value: string };
type ReviewMap = Record<string, Review>;

/** How an incoming card relates to what is already saved on the profile. */
type SavedState = { kind: "new" } | { kind: "same" } | { kind: "changed"; previous: string };

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

const pathNames: Record<CandidatePath, string> = {
  "new-grad": "New Grad / Fresher",
  experienced: "Experienced professional",
};

function initialReviews(facts: ProfileFact[]): ReviewMap {
  return Object.fromEntries(facts.map((fact) => [fact.id, { status: "suggested", value: fact.value }])) as ReviewMap;
}

/**
 * How each incoming card compares with the saved profile. Cards the profile
 * already holds identically are pre-confirmed: the user reviewed them once,
 * and a second upload should not ask again.
 */
function matchSaved(
  facts: ProfileFact[],
  saved: MergeExistingFact[],
): { states: Record<string, SavedState>; reviews: ReviewMap } {
  const reports: Record<string, SavedState> = {};
  const reviews = initialReviews(facts);
  if (saved.length === 0) return { states: reports, reviews };

  const byIdentity = new Map(saved.map((fact) => [factIdentity(fact), fact]));

  for (const fact of facts) {
    const match = byIdentity.get(factIdentity({ groupId: fact.group, key: fact.id, label: fact.label, value: fact.value }));

    if (!match) {
      reports[fact.id] = { kind: "new" };
      continue;
    }

    if (normalizeFactValue(match.value) === normalizeFactValue(fact.value)) {
      reports[fact.id] = { kind: "same" };
      reviews[fact.id] = { status: "confirmed", value: fact.value };
      continue;
    }

    reports[fact.id] = { kind: "changed", previous: match.value };
  }

  return { states: reports, reviews };
}

function restoreReviews(facts: ProfileFact[], raw: string | null): ReviewMap | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const reviews = initialReviews(facts);
    for (const fact of facts) {
      const entry = (parsed as Record<string, unknown>)[fact.id];
      if (typeof entry !== "object" || entry === null) continue;

      const { status, value } = entry as { status?: unknown; value?: unknown };
      if (typeof status !== "string" || !(status in statusLabels)) continue;

      reviews[fact.id] = {
        status: status as FactStatus,
        value: typeof value === "string" && value.trim() ? value : fact.value,
      };
    }

    return reviews;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractErrorMessage(reason: string): string {
  switch (reason) {
    case "too-large":
      return "That file is larger than 5 MB. Choose a smaller file.";
    case "unsupported-type":
      return "Upload a PDF or DOCX file. Other formats are not supported yet.";
    case "too-many-pages":
      return "That PDF has more than 12 pages. Upload only the pages that contain your resume.";
    case "empty":
      return "We could not read any text from that file, even with OCR. Try a clearer scan or a text-based PDF/DOCX.";
    case "no-facts":
      return "We could not find profile details in that file. Try another file.";
    default:
      return "We could not read that file. Try another PDF or DOCX, or use the sample review.";
  }
}

export default function ResumeIntake({
  initialPath,
  initialPhase,
  signedIn,
  aiEnabled,
  existingFacts = [],
}: {
  initialPath: CandidatePath | "";
  initialPhase: Phase;
  signedIn: boolean;
  aiEnabled: boolean;
  /** Facts already saved on this account, used to merge instead of replace. */
  existingFacts?: MergeExistingFact[];
}) {
  const path: CandidatePath = initialPath || "new-grad";
  const sample = sampleExtractions[path];
  const storageKey = `jobautomation.resume-review.${path}`;
  const nextPath = `/onboarding/resume?path=${path}&step=review`;
  const signInToUploadPath = `/sign-in?next=${encodeURIComponent(`/onboarding/resume?path=${path}`)}`;
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [uploaded, setUploaded] = useState<ResumeProposal | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedStates, setSavedStates] = useState<Record<string, SavedState>>({});
  const [saveResult, setSaveResult] = useState<{ added: number; updated: number; kept: number } | null>(null);
  const mergeMode = existingFacts.length > 0;
  const [reviews, setReviews] = useState<ReviewMap>(() => {
    const fresh = initialReviews(sample.facts);
    if (typeof window === "undefined") return fresh;

    try {
      return restoreReviews(sample.facts, window.sessionStorage.getItem(storageKey)) ?? fresh;
    } catch {
      return fresh;
    }
  });

  const extraction = uploaded ?? sample;

  useEffect(() => {
    if (uploaded) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(reviews));
    } catch {
      // Storage can be unavailable in private modes; the review still works in memory.
    }
  }, [reviews, storageKey, uploaded]);

  const statusOf = (id: string): FactStatus => reviews[id]?.status ?? "suggested";
  const counts = countByStatus(extraction.facts, statusOf);
  const total = extraction.facts.length;
  const reviewed = total - counts.remaining;
  const percent = total === 0 ? 0 : Math.round((reviewed / total) * 100);
  const allReviewed = counts.remaining === 0;

  const savedEntries = Object.values(savedStates);
  const savedCounts = {
    same: savedEntries.filter((entry) => entry.kind === "same").length,
    changed: savedEntries.filter((entry) => entry.kind === "changed").length,
    new: savedEntries.filter((entry) => entry.kind === "new").length,
  };

  const groups = extraction.groups.map((id) => ({
    ...factGroups[id],
    id,
    facts: extraction.facts.filter((fact) => fact.group === id),
  }));

  function acceptFile(next: File | null) {
    if (!next) return;

    if (!signedIn) {
      setFileError("Sign in to read your own resume.");
      return;
    }

    const lower = next.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      setFile(null);
      setFileError("Choose a PDF or DOCX file. Other formats are not supported yet.");
      return;
    }

    if (next.size > MAX_BYTES) {
      setFile(null);
      setFileError("That file is larger than 5 MB. Choose a smaller file.");
      return;
    }

    setFileError(null);
    setFile(next);
  }

  async function readUploadedResume() {
    if (!file) return;

    setExtracting(true);
    setFileError(null);

    try {
      const data = new FormData();
      data.append("resume", file);
      const result = await extractResumeFacts(data);

      if (!result.ok) {
        setFileError(extractErrorMessage(result.reason));
        setExtracting(false);
        return;
      }

      setUploaded(result.extraction);
      const matched = matchSaved(result.extraction.facts, existingFacts);
      setReviews(matched.reviews);
      setSavedStates(matched.states);
      setPhase("review");
    } catch {
      setFileError("We could not read that file. Try another PDF or DOCX, or use the sample review.");
    } finally {
      setExtracting(false);
    }
  }

  function setStatus(id: string, status: FactStatus, value?: string) {
    setReviews((current) => ({
      ...current,
      [id]: { status, value: value ?? current[id]?.value ?? "" },
    }));
  }

  function startOver() {
    setReviews(initialReviews(sample.facts));
    setSavedStates({});
    setSaveResult(null);
    setUploaded(null);
    setExtracting(false);
    setFile(null);
    setFileError(null);
    setSaveError(null);
    setPhase("intake");
    router.replace(`/onboarding/resume?path=${path}`);
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Nothing to clear.
    }
  }

  async function saveProfile() {
    setSaving(true);
    setSaveError(null);

    const payload = extraction.facts.flatMap((fact) => {
      const review = reviews[fact.id];
      if (!review || review.status === "suggested") return [];

      return [
        {
          key: fact.id,
          groupId: fact.group,
          label: fact.label,
          value: review.value,
          sourceText: fact.source,
          confidence: fact.confidence,
          status: review.status,
          ...(fact.hint ? { hint: fact.hint } : {}),
        },
      ];
    });

    try {
      const result = await saveProfileFacts(payload, mergeMode ? "merge" : "replace");
      if (result.ok) {
        setSaveResult({ added: result.added, updated: result.updated, kept: result.kept });
        setPhase("done");
        return;
      }

      if (result.reason === "unauthenticated") {
        router.push(`/sign-in?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      setSaveError("Those details could not be saved. Review them and try again.");
    } catch {
      setSaveError("Saving failed. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!initialPath) {
    return (
      <main className="onboarding-page">
        <StepHeader step="Step 1 needed" />
        <section className="onboarding-content" aria-labelledby="pick-title">
          <p className="section-kicker">Before the resume</p>
          <h1 id="pick-title">Choose your starting point first.</h1>
          <p className="onboarding-intro">
            Which details we ask about depends on where you are in your career. Pick a path and you will come straight back here.
          </p>
          <div className="path-options">
            {(Object.keys(pathNames) as CandidatePath[]).map((value) => (
              <Link className="onboarding-choice" href={`/onboarding/resume?path=${value}`} key={value}>
                <span className="choice-copy">
                  <span className="choice-title">{pathNames[value]}</span>
                </span>
                <span className="choice-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <StepFooter path={initialPath} />
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="onboarding-page">
        <StepHeader step="Step 2" />
        <section className="onboarding-content" aria-labelledby="done-title">
          <div className="path-confirmation review-done">
            <span className="confirmation-mark" aria-hidden="true">✓</span>
            <div>
              <p className="confirmation-kicker">{mergeMode ? "Profile updated" : "Review complete"}</p>
              <h2 id="done-title">
                {mergeMode ? "Your profile is up to date." : `${counts.kept} ${counts.kept === 1 ? "detail is" : "details are"} ready to reuse`}
              </h2>
              <p className="confirmation-copy">
                {mergeMode
                  ? "Your earlier details are still there. This upload only added or refreshed what you confirmed — nothing was deleted."
                  : "These are the facts a job application would draw on. Everything else stays out of your profile and can still be answered per application."}
              </p>
              <dl className="review-done-counts">
                {mergeMode && saveResult ? (
                  <>
                    <div>
                      <dt>Added</dt>
                      <dd>{saveResult.added}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{saveResult.updated}</dd>
                    </div>
                    <div>
                      <dt>Unchanged</dt>
                      <dd>{saveResult.kept}</dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt>Kept</dt>
                      <dd>{counts.kept}</dd>
                    </div>
                    <div>
                      <dt>Skipped</dt>
                      <dd>{counts.skipped}</dd>
                    </div>
                    <div>
                      <dt>Not applicable</dt>
                      <dd>{counts.notApplicable}</dd>
                    </div>
                  </>
                )}
              </dl>
              <div className="confirmation-actions">
                <button className="onboarding-submit" type="button" onClick={startOver}>
                  {mergeMode ? "Upload another version" : "Review these details again"} <span aria-hidden="true">↺</span>
                </button>
                {signedIn ? (
                  <>
                    <Link className="onboarding-submit" href="/dashboard">
                      Go to your overview <span aria-hidden="true">→</span>
                    </Link>
                    <Link className="intake-secondary" href="/profile">
                      View saved profile
                    </Link>
                  </>
                ) : (
                  <Link className="intake-secondary" href="/onboarding">
                    Change career path
                  </Link>
                )}
              </div>
            </div>
          </div>
          <p className="intake-privacy">
            Saved to your account. Job matching, document drafts and form answers all read these confirmed facts — nothing
            reaches an employer until you submit it yourself.
          </p>
        </section>
        <StepFooter path={path} />
      </main>
    );
  }

  if (phase === "intake") {
    return (
      <main className="onboarding-page">
        <StepHeader step="Step 2" />
        <section aria-labelledby="resume-title" className="intake-layout">
          <div className="intake-lede">
            <p className="section-kicker">Step 2 · Resume intake</p>
            <h1 id="resume-title">
              {mergeMode ? (
                <>Adding a newer resume?</>
              ) : (
                <>
                  Your resume, read once.
                  <br />
                  <em>Then never again.</em>
                </>
              )}
            </h1>
            <p className="onboarding-intro">
              {mergeMode
                ? `Your profile already holds ${existingFacts.length} confirmed details. This upload only adds or refreshes them — nothing already saved is deleted, and you review each change first.`
                : "We read the file to propose profile details, with the exact line each one came from. You confirm what is true. From then on, your profile is the only thing we use."}
            </p>

            <ol className="intake-route">
              <li>
                <span aria-hidden="true">01</span>
                <div>
                  <b>Read</b>
                  <p>PDF or DOCX, text or scanned pages. The file is discarded after reading.</p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">02</span>
                <div>
                  <b>Review</b>
                  <p>One card per company and per project, each with its source line. Keep, edit or skip.</p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">03</span>
                <div>
                  <b>Save once</b>
                  <p>Confirmed details become your profile. Later uploads merge into it and delete nothing.</p>
                </div>
              </li>
            </ol>

            <p className="intake-privacy">
              Read on this server. Nothing is shared with an employer, and no fact is written without your confirmation.
            </p>
          </div>

          <div className="intake-panel">
            <p className="intake-note">
              <span aria-hidden="true">✳</span>
              <span>
                {signedIn ? (
                  <>
                    <strong>Reads on this server.</strong>{" "}
                    {aiEnabled
                      ? "Your PDF or DOCX is read by Google Gemini (via your configured API key) to propose facts and is not stored. Only the resume text is sent."
                      : "Your PDF or DOCX is parsed in memory by text rules and is not stored. No AI provider receives it."}
                  </>
                ) : (
                  <>
                    <strong>Sign in to read your own resume.</strong> Until then you can preview the review step with sample
                    details.
                  </>
                )}
              </span>
            </p>

            <div
              className={`dropzone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}${signedIn ? "" : " is-locked"}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                acceptFile(event.dataTransfer.files[0] ?? null);
              }}
            >
              <input
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                disabled={!signedIn}
                id="resume-file"
                onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <label className="dropzone-label" htmlFor="resume-file">
                <span className="dropzone-icon" aria-hidden="true">
                  {file ? "✓" : "▤"}
                </span>
                <span className="dropzone-copy">
                  <span className="dropzone-title">{file ? file.name : "Drop your resume here"}</span>
                  <span className="dropzone-meta">
                    {file ? `${formatBytes(file.size)} · PDF or DOCX` : "or choose a file · PDF or DOCX · up to 5 MB"}
                  </span>
                </span>
                <span aria-hidden="true" className="dropzone-choose">
                  {file ? "Replace" : "Browse"}
                </span>
              </label>

              <div className="dropzone-foot">
                {file ? (
                  <button className="text-button" onClick={() => setFile(null)} type="button">
                    Remove file
                  </button>
                ) : null}
                {!signedIn ? (
                  <Link className="text-button" href={signInToUploadPath}>
                    Sign in to read your resume
                  </Link>
                ) : null}
                {fileError ? (
                  <p className="intake-error" role="alert">
                    {fileError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="intake-actions">
              <button
                className="onboarding-submit"
                disabled={!file || !signedIn || extracting}
                onClick={readUploadedResume}
                type="button"
              >
                {extracting ? "Reading your resume…" : "Read my resume"} <span aria-hidden="true">→</span>
              </button>
              <button className="intake-secondary" onClick={() => setPhase("review")} type="button">
                Preview with sample details
              </button>
            </div>
          </div>
        </section>
        <StepFooter path={path} />
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <StepHeader step="Step 2" />
      <section className="onboarding-content onboarding-content-wide" aria-labelledby="review-title">
        <div className="review-topline">
          <div>
            <p className="section-kicker">Step 2 · Review</p>
            <h1 id="review-title">Check every detail before it counts.</h1>
            <p className="onboarding-intro">
              Confirm what is right, correct what is wrong, and skip what you do not want to reuse. Each item shows the resume
              line it came from.
            </p>
          </div>
          <div className="review-doc">
            <span className="review-doc-label">Source file</span>
            <strong>{uploaded ? uploaded.documentName : extraction.documentName}</strong>
            <small>{uploaded ? "Read on this server · file not stored" : "Sample document · not uploaded"}</small>
          </div>
        </div>

        <p className="review-banner" role="note">
          {uploaded
            ? uploaded.ocr
              ? "This PDF has no text layer, so it was read with English OCR — characters can be misread. Check every detail against your file."
              : uploaded.method === "ai"
                ? "Read by Google Gemini, then checked line by line against your resume — any fact whose source line could not be found was dropped."
                : "Read from your file by plain text rules — no AI was used. Check each detail; nothing here is added that is not in your resume."
            : "Illustrative extraction from a fictional resume. Upload your own PDF or DOCX to review real details."}
        </p>

        {mergeMode && uploaded ? (
          <p className="review-banner review-merge" role="note">
            Compared with your saved profile: <strong>{savedCounts.new} new</strong>,{" "}
            <strong>{savedCounts.changed} changing</strong> and <strong>{savedCounts.same} already saved</strong>.
            Already-saved cards are pre-confirmed, so you only need to look at the rest.
          </p>
        ) : null}

        <div className="review-shell">
          <div className="review-groups">
            {groups.map((group) => (
              <section aria-labelledby={`group-${group.id}`} className="fact-group" key={group.id}>
                <div className="fact-group-head">
                  <h2 id={`group-${group.id}`}>{group.title}</h2>
                  <span>{group.note}</span>
                </div>
                <div className="fact-list">
                  {group.facts.map((fact) => (
                    <FactCard
                      fact={fact}
                      key={fact.id}
                      onSave={(value) => setStatus(fact.id, "edited", value)}
                      onStatus={(status) => setStatus(fact.id, status)}
                      review={reviews[fact.id] ?? { status: "suggested", value: fact.value }}
                      saved={savedStates[fact.id]}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside aria-label="Review progress" className="review-summary">
            <div className="review-progress-head">
              <span>Reviewed</span>
              <strong>{reviewed} / {total}</strong>
            </div>
            <div className="review-progress-track">
              <span style={{ width: `${percent}%` }} />
            </div>
            <p aria-live="polite" className="sr-only">
              {reviewed} of {total} details reviewed.
            </p>

            <dl className="review-counts">
              <div>
                <dt><span aria-hidden="true" className="count-dot dot-kept" /> Kept</dt>
                <dd>{counts.kept}</dd>
              </div>
              <div>
                <dt><span aria-hidden="true" className="count-dot dot-skipped" /> Skipped</dt>
                <dd>{counts.skipped}</dd>
              </div>
              <div>
                <dt><span aria-hidden="true" className="count-dot dot-na" /> Not applicable</dt>
                <dd>{counts.notApplicable}</dd>
              </div>
              <div>
                <dt><span aria-hidden="true" className="count-dot dot-open" /> Not reviewed</dt>
                <dd>{counts.remaining}</dd>
              </div>
            </dl>

            <div className="review-open">
              <h2>Still needed</h2>
              <ul>
                {extraction.openQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
              <p>Your resume did not answer these. We ask only when a job needs them, and never guess.</p>
            </div>

            {allReviewed && !signedIn ? (
              <Link className="onboarding-submit" href={`/sign-in?next=${encodeURIComponent(nextPath)}`}>
                Sign in to save <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <button
                className="onboarding-submit"
                disabled={!allReviewed || saving}
                onClick={saveProfile}
                type="button"
              >
                {saving ? "Saving…" : mergeMode ? "Update my profile" : "Save this profile"} <span aria-hidden="true">→</span>
              </button>
            )}
            {saveError ? (
              <p className="auth-error" role="alert">{saveError}</p>
            ) : null}
            <p className="review-summary-note">
              {!allReviewed
                ? `Review the remaining ${counts.remaining} ${counts.remaining === 1 ? "detail" : "details"} to continue.`
                : signedIn
                  ? mergeMode
                    ? "Saving adds the new details and refreshes the changed ones. Nothing already on your profile is removed."
                    : "All details reviewed. Saving stores them on your account, and you can delete them later."
                  : "Sign in to save these facts to your account. Your review stays in this browser."}
            </p>
          </aside>
        </div>
      </section>
      <StepFooter path={path} />
    </main>
  );
}

function StepHeader({ step }: { step: string }) {
  const current = step.includes("1") ? 1 : 2;
  return (
    <>
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          Step {current} of 2 <span aria-hidden="true">·</span> {current === 1 ? "about a minute" : "about 2 minutes"}
        </span>
      </header>
      <div className="onboarding-progress" aria-hidden="true"><i style={{ width: `${current * 50}%` }} /></div>
    </>
  );
}

function StepFooter({ path }: { path: CandidatePath | "" }) {
  return (
    <footer className="onboarding-footer">
      <Link href={path ? `/onboarding?path=${path}` : "/onboarding"}>← Back to your career path</Link>
      <span>Your facts stay yours. You review what gets used.</span>
    </footer>
  );
}

type StructuredKind = "experience" | "project";
type StructuredDraft = { primary: string; secondary: string; meta: string; body: string };

function parseStructured(kind: StructuredKind, value: string): StructuredDraft {
  const lines = value.split("\n").map((line) => line.trim());
  const title = lines[0] ?? "";
  const [primary, ...rest] = title.split(/\s+[—–−-]\s+/);
  const remaining = lines.slice(1);

  let meta = "";
  const first = remaining[0];
  if (kind === "experience" && first && !/^[•\-]/.test(first)) {
    meta = remaining.shift() ?? "";
  }

  return {
    primary: primary?.trim() ?? "",
    secondary: rest.join(" — ").trim(),
    meta,
    body: remaining.map((line) => line.replace(/^[•\-]\s*/, "")).join("\n"),
  };
}

function composeStructured(kind: StructuredKind, draft: StructuredDraft): string {
  const title = draft.secondary.trim() ? `${draft.primary.trim()} — ${draft.secondary.trim()}` : draft.primary.trim();
  const bullets = draft.body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`);

  const lines = kind === "experience" ? [title, draft.meta.trim(), ...bullets] : [title, ...bullets];
  return lines.filter(Boolean).join("\n");
}

function FactCard({
  fact,
  review,
  saved,
  onSave,
  onStatus,
}: {
  fact: ProfileFact;
  review: Review;
  saved?: SavedState;
  onSave: (value: string) => void;
  onStatus: (status: FactStatus) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [structured, setStructured] = useState<StructuredDraft | null>(null);

  const kind: StructuredKind | null =
    fact.label === "Experience" ? "experience" : fact.label === "Project" ? "project" : null;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (structured) firstFieldRef.current?.focus();
    else inputRef.current?.focus();
  }, [editing, structured]);

  function startEdit() {
    if (kind && review.value.includes("\n")) setStructured(parseStructured(kind, review.value));
    else {
      setStructured(null);
      setDraft(review.value);
    }
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setStructured(null);
  }

  function saveEdit() {
    const value = structured && kind ? composeStructured(kind, structured) : draft.trim();
    if (!value.trim()) return;

    onSave(value);
    setEditing(false);
    setStructured(null);
  }

  const kept = review.status === "confirmed" || review.status === "edited";

  return (
    <article className={`fact-card is-${review.status}`}>
      <div className="fact-head">
        <span className="fact-label">{fact.label}</span>
        <div className="fact-badges">
          {saved?.kind === "new" ? <span className="fact-merge merge-new">New</span> : null}
          {saved?.kind === "same" ? <span className="fact-merge merge-same">Already saved</span> : null}
          {saved?.kind === "changed" ? <span className="fact-merge merge-changed">Updates saved</span> : null}
          <span className={`fact-confidence confidence-${fact.confidence}`}>
            {confidenceLabels[fact.confidence]}
          </span>
          {review.status !== "suggested" ? (
            <span className={`fact-status status-${review.status}`}>{statusLabels[review.status]}</span>
          ) : null}
        </div>
      </div>

      {saved?.kind === "changed" && !editing ? (
        <p className="fact-previous">
          <span>Saved now</span>
          <q>{saved.previous}</q>
        </p>
      ) : null}

      {editing ? (
        <div className="fact-edit">
          {structured && kind ? (
            <div className="fact-edit-fields">
              <label>
                <span>{kind === "experience" ? "Company" : "Project name"}</span>
                <input
                  id={`${fact.id}-primary`}
                  onChange={(event) => setStructured({ ...structured, primary: event.target.value })}
                  ref={firstFieldRef}
                  type="text"
                  value={structured.primary}
                />
              </label>
              <label>
                <span>{kind === "experience" ? "Role" : "Tech stack"}</span>
                <input
                  id={`${fact.id}-secondary`}
                  onChange={(event) => setStructured({ ...structured, secondary: event.target.value })}
                  type="text"
                  value={structured.secondary}
                />
              </label>
              {kind === "experience" ? (
                <label>
                  <span>Timeline</span>
                  <input
                    id={`${fact.id}-meta`}
                    onChange={(event) => setStructured({ ...structured, meta: event.target.value })}
                    type="text"
                    value={structured.meta}
                  />
                </label>
              ) : null}
              <label>
                <span>{kind === "experience" ? "What you did (one line per bullet)" : "Description (one line per bullet)"}</span>
                <textarea
                  id={`${fact.id}-body`}
                  onChange={(event) => setStructured({ ...structured, body: event.target.value })}
                  rows={Math.min(8, Math.max(3, structured.body.split("\n").length))}
                  value={structured.body}
                />
              </label>
            </div>
          ) : (
            <>
              <label className="sr-only" htmlFor={`edit-${fact.id}`}>Edit {fact.label}</label>
              <input
                id={`edit-${fact.id}`}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveEdit();
                  if (event.key === "Escape") cancelEdit();
                }}
                ref={inputRef}
                type="text"
                value={draft}
              />
            </>
          )}
          <div className="fact-edit-actions">
            <button className="fact-action is-primary" onClick={saveEdit} type="button">
              Save
            </button>
            <button className="fact-action" onClick={cancelEdit} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="fact-value">{review.value}</p>
      )}

      <p className="fact-source">
        <span>From your resume</span>
        <q>{fact.source}</q>
      </p>

      {fact.hint ? <p className="fact-hint">{fact.hint}</p> : null}

      {!editing ? (
        <div aria-label={`${fact.label} review actions`} className="fact-actions" role="group">
          <button
            aria-pressed={kept}
            className={`fact-action${kept ? " is-primary" : ""}`}
            onClick={() => onStatus("confirmed")}
            type="button"
          >
            Confirm
          </button>
          <button className="fact-action" onClick={startEdit} type="button">
            Edit
          </button>
          <button
            aria-pressed={review.status === "skipped"}
            className="fact-action"
            onClick={() => onStatus("skipped")}
            type="button"
          >
            Skip
          </button>
          <button
            aria-pressed={review.status === "not-applicable"}
            className="fact-action"
            onClick={() => onStatus("not-applicable")}
            type="button"
          >
            Not applicable
          </button>
          <button
            className="fact-action fact-reset"
            disabled={review.status === "suggested"}
            onClick={() => onStatus("suggested")}
            type="button"
          >
            Reset
          </button>
        </div>
      ) : null}
    </article>
  );
}
