"use client";

import { useEffect, useSyncExternalStore } from "react";

type Mode = "auto" | "light" | "dark";

const STORAGE_KEY = "jobautomation-theme";
const EVENT = "jobautomation:theme";

function readMode(): Mode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "auto" ? stored : "light";
  } catch {
    return "light";
  }
}

/** The server reads this cookie, so the next render starts in the right theme. */
function writeThemeCookie(mode: Mode) {
  document.cookie = `${STORAGE_KEY}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange();

  media.addEventListener("change", handler);
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT, handler);

  return () => {
    media.removeEventListener("change", handler);
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT, handler);
  };
}

export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, readMode, () => "light" as Mode);
  // True only after hydration, so the pressed state never disagrees with SSR.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const root = document.documentElement;
    // Light is the default, so it is expressed by the absence of the attribute.
    if (mode === "light") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
  }, [mode]);

  function choose(next: Mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      writeThemeCookie(next);
    } catch {
      // Storage can be unavailable; the choice still applies for this page.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div className="theme-dock">
      <div aria-label="Colour theme" className="theme-toggle" role="group">
        {(["light", "dark", "auto"] as const).map((option) => (
          <button
            aria-pressed={mounted ? mode === option : undefined}
            key={option}
            onClick={() => choose(option)}
            title={
              option === "auto"
                ? "Follow this computer's theme"
                : `${option === "light" ? "Light" : "Dark"} theme`
            }
            type="button"
          >
            {option === "auto" ? "Auto" : option === "light" ? "Light" : "Dark"}
          </button>
        ))}
      </div>
    </div>
  );
}
