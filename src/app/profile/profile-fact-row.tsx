"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateProfileFact } from "@/app/actions/profile-fact";

type Status = "CONFIRMED" | "EDITED" | "SKIPPED" | "NOT_APPLICABLE" | "SUGGESTED";

const statusLabels: Record<string, string> = {
  SUGGESTED: "Not reviewed",
  CONFIRMED: "Confirmed",
  EDITED: "Edited",
  SKIPPED: "Skipped",
  NOT_APPLICABLE: "Not applicable",
};

const statusClass: Record<string, string> = {
  SUGGESTED: "suggested",
  CONFIRMED: "confirmed",
  EDITED: "edited",
  SKIPPED: "skipped",
  NOT_APPLICABLE: "not-applicable",
};

export default function ProfileFactRow({
  fact,
}: {
  fact: { key: string; label: string; value: string; sourceText: string; status: Status };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fact.value);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    startTransition(async () => {
      await updateProfileFact(formData);
      setEditing(false);
      router.refresh();
    });
  }

  function setStatus(status: "confirmed" | "skipped" | "not-applicable") {
    const data = new FormData();
    data.set("key", fact.key);
    data.set("value", fact.value);
    data.set("status", status);
    save(data);
  }

  const klass = statusClass[fact.status] ?? "suggested";

  return (
    <article className={`fact-card is-${klass}`}>
      <div className="fact-head">
        <span className="fact-label">{fact.label}</span>
        <div className="fact-badges">
          <span className={`fact-status status-${klass}`}>{statusLabels[fact.status] ?? fact.status}</span>
        </div>
      </div>

      {editing ? (
        <form action={save} className="fact-edit">
          <input name="key" type="hidden" value={fact.key} />
          <input name="status" type="hidden" value="confirmed" />
          <label className="sr-only" htmlFor={`fact-${fact.key}`}>Edit {fact.label}</label>
          {fact.value.includes("\n") ? (
            <textarea
              defaultValue={draft}
              id={`fact-${fact.key}`}
              name="value"
              onChange={(event) => setDraft(event.target.value)}
              rows={Math.min(8, draft.split("\n").length + 1)}
            />
          ) : (
            <input
              defaultValue={draft}
              id={`fact-${fact.key}`}
              name="value"
              onChange={(event) => setDraft(event.target.value)}
              type="text"
            />
          )}
          <div className="fact-edit-actions">
            <button className="fact-action is-primary" disabled={pending || !draft.trim()} type="submit">
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              className="fact-action"
              onClick={() => {
                setDraft(fact.value);
                setEditing(false);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="fact-value">{fact.value}</p>
      )}

      <p className="fact-source">
        <span>From your resume</span>
        <q>{fact.sourceText}</q>
      </p>

      {!editing ? (
        <div className="fact-actions">
          <button className="fact-action" disabled={pending} onClick={() => setEditing(true)} type="button">
            Edit
          </button>
          {fact.status !== "CONFIRMED" && fact.status !== "EDITED" ? (
            <button className="fact-action is-primary" disabled={pending} onClick={() => setStatus("confirmed")} type="button">
              Confirm
            </button>
          ) : null}
          {fact.status !== "SKIPPED" ? (
            <button className="fact-action" disabled={pending} onClick={() => setStatus("skipped")} type="button">
              Skip
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
