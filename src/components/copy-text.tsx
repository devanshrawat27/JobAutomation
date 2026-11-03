"use client";

import { useState } from "react";

/** Copies a block of text and says so for a moment. Nothing is sent anywhere. */
export default function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="copy-text"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      type="button"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
