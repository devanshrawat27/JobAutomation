const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

type MonthIndex = { year: number; month: number };

export type DateRange = { start: MonthIndex; end: MonthIndex; open?: boolean };

/**
 * Parse the date ranges that appear in profile facts, e.g.
 * "Aug 2026 – Present", "Jul 2020 – Feb 2023", "2023 – 2027".
 */
export function parseDateRange(value: string, now = new Date()): DateRange | null {
  const text = value.replace(/\s+/g, " ").trim();

  const withMonths = text.match(
    /\b([A-Za-z]{3,9})\.?\s+(\d{4})\s*[–—−-]\s*(?:(present|current|now|today)|([A-Za-z]{3,9})\.?\s+(\d{4}))/i,
  );
  if (withMonths) {
    const startMonth = MONTHS[withMonths[1].toLowerCase()];
    const startYear = Number(withMonths[2]);
    if (startMonth === undefined) return null;

    if (withMonths[3]) {
      return {
        start: { year: startYear, month: startMonth },
        end: { year: now.getFullYear(), month: now.getMonth() },
        open: true,
      };
    }

    const endMonth = MONTHS[withMonths[4].toLowerCase()];
    const endYear = Number(withMonths[5]);
    if (endMonth === undefined) return null;
    return { start: { year: startYear, month: startMonth }, end: { year: endYear, month: endMonth } };
  }

  const yearsOnly = text.match(/\b(\d{4})\s*[–—−-]\s*(?:(present|current|now|today)|(\d{4}))/i);
  if (yearsOnly) {
    const start = { year: Number(yearsOnly[1]), month: 0 };
    if (yearsOnly[2]) return { start, end: { year: now.getFullYear(), month: now.getMonth() }, open: true };
    return { start, end: { year: Number(yearsOnly[3]), month: 11 } };
  }

  return null;
}

function toMonthNumber({ year, month }: MonthIndex): number {
  return year * 12 + month;
}

/** Months for one range. An open-ended "Present" range counts elapsed months, not inclusive ones. */
export function rangeMonths(range: DateRange): number {
  const span = toMonthNumber(range.end) - toMonthNumber(range.start) + 1 - (range.open ? 1 : 0);
  return Math.max(0, span);
}

/** Total months after merging overlapping ranges, so two concurrent roles do not double-count. */
export function totalMonths(ranges: DateRange[]): number {
  if (ranges.length === 0) return 0;

  const sorted = ranges
    .map((range) => ({ start: toMonthNumber(range.start), end: toMonthNumber(range.end) }))
    .sort((left, right) => left.start - right.start);

  let total = 0;
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;

  for (const range of sorted.slice(1)) {
    if (range.start <= currentEnd + 1) {
      currentEnd = Math.max(currentEnd, range.end);
      continue;
    }
    total += currentEnd - currentStart + 1;
    currentStart = range.start;
    currentEnd = range.end;
  }

  total += currentEnd - currentStart + 1;
  return total;
}

/** The years a posting asks for, if it states them. */
export function requiredYears(text: string): number | null {
  const match = text.match(/\b(\d{1,2})(?:\s*\+)?\s*(?:\s*(?:to|-)\s*(\d{1,2}))?\s*years?\b/i);
  if (!match) return null;
  const lower = Number(match[1]);
  const upper = match[2] ? Number(match[2]) : lower;
  if (!Number.isFinite(lower) || lower <= 0 || lower > 50) return null;
  return upper > lower ? lower : lower;
}

export function formatMonths(months: number): string {
  if (months <= 0) return "no dated experience";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  if (rest === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${rest} month${rest === 1 ? "" : "s"}`;
}
