import { parse } from "node-html-parser";

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const value = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    if (code.startsWith("#")) {
      const value = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return NAMED[code.toLowerCase()] ?? match;
  });
}

/** Zero-width, bidi, soft hyphen and tag characters: invisible to a reader. */
export function stripInvisible(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u180E]/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[\u{E0000}-\u{E007F}]/gu, "");
}

const HIDDEN_STYLE =
  /(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:[;\s]|$)|font-size\s*:\s*0(?:[;\s]|$)|color\s*:\s*transparent|clip\s*:\s*rect\(|clip-path|left\s*:\s*-\d{4,}|top\s*:\s*-\d{4,}|text-indent\s*:\s*-\d{4,}|position\s*:\s*absolute;\s*(?:left|top)\s*:\s*-\d{4,})/i;

const BLOCK_TAGS = [
  "p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "table", "section", "article", "header", "footer", "blockquote", "br",
];

const LATIN = /[a-z]/i;
const CYRILLIC = /[\u0400-\u04FF]/;
const GREEK = /[\u0370-\u03FF]/;

/**
 * Words that mix Latin letters with Cyrillic or Greek ones. Legitimate postings
 * rarely need them; they are a common way to spoof a word a reader skims past.
 */
export function findLookalikeWords(text: string): string[] {
  const found = new Set<string>();
  for (const word of text.split(/\s+/)) {
    if (word.length < 3) continue;
    if (LATIN.test(word) && (CYRILLIC.test(word) || GREEK.test(word))) found.add(word.slice(0, 40));
  }
  return [...found].slice(0, 5);
}

/**
 * Turn a job description into readable text.
 *
 * Mirrors the posting-integrity idea from `ai-job-search/tools/posting_guard.py`:
 * script/style and hidden nodes never reach the text, and invisible characters
 * (zero-width, bidi, tag characters) are removed, so a posting cannot smuggle
 * instructions past the reader's eyes.
 */
export function htmlToText(html: string): string {
  const decoded = decodeEntities(html);

  let root;
  try {
    root = parse(decoded, { comment: false });
  } catch {
    return stripInvisible(decoded.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  }

  root.querySelectorAll("script, style, noscript, template, svg, iframe, object, embed").forEach((node) => node.remove());
  root.querySelectorAll("[hidden], [aria-hidden='true'], [aria-hidden=true]").forEach((node) => node.remove());

  root.querySelectorAll("*").forEach((node) => {
    const style = node.getAttribute("style");
    if (style && HIDDEN_STYLE.test(style)) node.remove();
  });

  for (const tag of BLOCK_TAGS) {
    root.querySelectorAll(tag).forEach((node) => node.insertAdjacentHTML("afterend", "\n"));
  }

  const text = stripInvisible(root.text ?? "");
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00A0]+/g, " ").trim())
    .filter((line) => line.length > 0);

  // Collapse runs of blank lines left by removed nodes.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
