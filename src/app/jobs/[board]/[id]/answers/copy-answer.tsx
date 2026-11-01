"use client";

import { useState } from "react";

export default function CopyAnswer({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="answer-copy" onClick={copy} type="button">
      {copied ? "Copied" : label}
    </button>
  );
}
