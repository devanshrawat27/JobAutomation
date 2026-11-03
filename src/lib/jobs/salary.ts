/**
 * Pay, read from the posting itself.
 *
 * Indian postings state pay in a dozen ways: "₹15–25 LPA", "₹1.8–4.2L",
 * "CTC: 12-18 lakhs", "₹50,000 per month", "up to ₹20 LPA". Everything is
 * normalised to lakhs per annum so the list can filter and compare. A range
 * that is not money (years of experience, a batch year, a headcount) is
 * ignored rather than guessed.
 */

export type SalaryRange = {
  /** Lakhs per annum. */
  min: number;
  max: number | null;
  /** The sentence the range came from, trimmed. */
  source: string;
};

const MIN_LPA = 0.6;
const MAX_LPA = 250;

const NUMBER = "\\d[\\d,]*(?:\\.\\d{1,2})?";

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function plausible(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_LPA && value <= MAX_LPA;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function annualise(value: number, monthly: boolean): number {
  return round(monthly ? (value * 12) / 100_000 : value);
}

function sentenceAround(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf(".", index) + 1, text.lastIndexOf("\n", index) + 1);
  const end = text.indexOf(".", index);
  return text
    .slice(start, end === -1 ? index + 100 : end + 1)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const HAS_PAY_UNIT = /lpa|lakh|lac|\bper annum\b|\bpa\b|\bl\b/i;
const HAS_CURRENCY = /₹|rs\.?|inr/i;
const IS_MONTHLY = /per month|\/month|monthly|\bpm\b/i;
const PAY_CONTEXT = /salary|ctc|compensation|package|stipend|remuneration|per annum|\bpa\b|\bpay\b/i;
/** Words that turn a number into business volume rather than pay. */
const NOT_PAY =
  /gmv|gross merchandise|revenue|turnover|budget|sales|clients?|customers?|accounts?|partners?|headcount|employees|students|users?|orders?|invoices?|transactions?/i;

function looksLikePay(text: string, index: number, length: number): boolean {
  const around = text.slice(Math.max(0, index - 70), Math.min(text.length, index + length + 70));
  if (PAY_CONTEXT.test(around)) return true;
  if (NOT_PAY.test(around)) return false;
  // A lakh/LPA unit with no business-volume words is very likely pay.
  return true;
}

/**
 * The first plausible pay range in the text, or null when the posting does not
 * state one. Ranges win over single figures, and monthly pay is annualised.
 */
export function parseSalary(text: string): SalaryRange | null {
  if (!text) return null;
  const haystack = text.replace(/\u00a0/g, " ");

  // "₹15–25 LPA", "1.8 - 4.2L", "12 to 18 lakhs", "₹50,000 – ₹80,000 a month"
  const range = new RegExp(
    `(?:₹|rs\\.?|inr)?\\s*(${NUMBER})\\s*(?:-|–|—|to)\\s*(${NUMBER})\\s*(lpa|lakhs?|lacs?|per annum|pa)?`,
    "gi",
  );

  for (const match of haystack.matchAll(range)) {
    const index = match.index ?? 0;
    const tail = haystack.slice(index, index + 60);
    const unit = match[3] ?? "";
    const hasPayUnit = HAS_PAY_UNIT.test(unit) || HAS_PAY_UNIT.test(match[0]);
    const hasCurrency = HAS_CURRENCY.test(match[0]);
    if (!hasPayUnit && !hasCurrency) continue;
    if (!looksLikePay(haystack, index, match[0].length)) continue;

    const rawMin = toNumber(match[1]);
    const rawMax = toNumber(match[2]);
    if (rawMin === null || rawMax === null) continue;

    const monthly = IS_MONTHLY.test(tail);
    const min = annualise(Math.min(rawMin, rawMax), monthly);
    const max = annualise(Math.max(rawMin, rawMax), monthly);
    if (!plausible(min) || !plausible(max)) continue;

    return { min, max, source: sentenceAround(haystack, index) };
  }

  // "₹50,000 per month" (also "50k a month")
  const monthlySingle = new RegExp(
    `(?:₹|rs\\.?|inr)\\s*(${NUMBER})\\s*(k)?\\s*(?:per month|\\/month|monthly|pm\\b)`,
    "gi",
  );
  for (const match of haystack.matchAll(monthlySingle)) {
    const raw = toNumber(match[1]);
    if (raw === null) continue;
    if (!looksLikePay(haystack, match.index ?? 0, match[0].length)) continue;
    const value = annualise(match[2] ? raw * 1000 : raw, true);
    if (!plausible(value)) continue;
    return { min: value, max: null, source: sentenceAround(haystack, match.index ?? 0) };
  }

  // "₹18 LPA", "CTC of 12 lakh"
  const single = new RegExp(`(?:₹|rs\\.?|inr)\\s*(${NUMBER})\\s*(lpa|lakhs?|lacs?)`, "gi");
  for (const match of haystack.matchAll(single)) {
    const raw = toNumber(match[1]);
    if (raw === null) continue;
    if (!looksLikePay(haystack, match.index ?? 0, match[0].length)) continue;
    const value = round(raw);
    if (!plausible(value)) continue;
    return { min: value, max: null, source: sentenceAround(haystack, match.index ?? 0) };
  }

  return null;
}

/** "₹15–25 LPA", "₹18 LPA", or null. */
export function formatSalary(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const show = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  if (min !== null && max !== null && min !== max) return `₹${show(min)}–${show(max)} LPA`;
  return `₹${show((min ?? max) as number)} LPA`;
}

/** Median of the salaries that were stated, in LPA. */
export function medianSalary(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10
    : sorted[middle];
}
