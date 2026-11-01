"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";

type Saved = { id: string; name: string; query: string };

const STORAGE_KEY = "jobautomation:saved-filters";
const EMPTY = "[]";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  const handler = () => onChange();
  listeners.add(handler);
  window.addEventListener("storage", handler);
  return () => {
    listeners.delete(handler);
    window.removeEventListener("storage", handler);
  };
}

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function parse(raw: string): Saved[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Saved =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Saved).id === "string" &&
        typeof (item as Saved).name === "string" &&
        typeof (item as Saved).query === "string",
    );
  } catch {
    return [];
  }
}

function write(next: Saved[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable; the chips still work for this page.
  }
  for (const listener of listeners) listener();
}

/**
 * Saves the current filter set under a name the candidate chooses, so
 * "Fresher · India · Engineering" is one click next time instead of four
 * selects. Stored in this browser only; nothing is sent to the server.
 */
export default function SavedFilters() {
  const params = useSearchParams();
  const raw = useSyncExternalStore(subscribe, readRaw, () => EMPTY);
  const saved = useMemo(() => parse(raw), [raw]);
  const [name, setName] = useState("");

  const query = useMemo(() => {
    const next = new URLSearchParams();
    const view = params.get("view");
    if (view) next.set("view", view);
    for (const key of ["family", "level", "where", "source", "q", "board"]) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    return next.toString();
  }, [params]);

  function save() {
    const label = name.trim().slice(0, 40);
    if (!label || !query) return;

    write([...saved.filter((item) => item.query !== query), { id: `${Date.now()}`, name: label, query }].slice(-6));
    setName("");
  }

  const activeFilters = ["family", "level", "where", "source"].filter((key) => params.get(key)).length;

  return (
    <div className="saved-filters">
      <div className="saved-filters-row">
        {saved.length > 0 ? (
          <ul className="saved-filters-list">
            {saved.map((item) => (
              <li key={item.id}>
                <Link className={item.query === query ? "is-active" : ""} href={`/jobs?${item.query}`}>
                  {item.name}
                </Link>
                <button
                  aria-label={`Remove saved filter ${item.name}`}
                  onClick={() => write(saved.filter((entry) => entry.id !== item.id))}
                  type="button"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="saved-filters-hint">
            Pick filters, then save the combination here — next time it is one click.
          </p>
        )}

        {activeFilters > 0 ? (
          <div className="saved-filters-add">
            <label className="sr-only" htmlFor="saved-filter-name">
              Name this filter
            </label>
            <input
              id="saved-filter-name"
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  save();
                }
              }}
              placeholder="Name this filter"
              value={name}
            />
            <button disabled={!name.trim()} onClick={save} type="button">
              Save
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
