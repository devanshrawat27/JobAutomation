import type { ProfileFact } from "@/lib/profile-facts";

const HIGHLIGHT = /highlight/i;
const MAX_MERGED_CHARS = 1200;

/**
 * Merged cards collect a source quote from every part they absorbed, so the same
 * line arrives several times. Keep the longest lines and drop any line already
 * contained in one of them.
 */
function uniqueSources(sources: string[]): string {
  const cleaned = sources.map((source) => source.replace(/\s+/g, " ").trim()).filter(Boolean);
  const longestFirst = [...new Set(cleaned)].sort((left, right) => right.length - left.length);
  const kept: string[] = [];

  for (const line of longestFirst) {
    if (!kept.some((entry) => entry.includes(line))) kept.push(line);
    if (kept.length >= 3) break;
  }

  return kept.join(" · ").slice(0, 420);
}

/**
 * One role or project should read as one card, not one card per bullet.
 *
 * Highlights that follow the same role/project are merged into a single fact
 * whose value holds one bullet per line. The source keeps every quoted line, so
 * provenance is unchanged; only the review surface gets smaller.
 */
export function mergeHighlights(facts: ProfileFact[]): ProfileFact[] {
  const merged: ProfileFact[] = [];
  let current: ProfileFact | null = null;

  for (const fact of facts) {
    if (HIGHLIGHT.test(fact.label)) {
      const combined = current && current.group === fact.group
        ? `${current.value}\n${fact.value}`
        : null;

      if (current && combined && combined.length <= MAX_MERGED_CHARS) {
        current.value = combined;
        current.source = uniqueSources([current.source, fact.source]);
        continue;
      }

      current = { ...fact };
      merged.push(current);
      continue;
    }

    current = null;
    merged.push(fact);
  }

  return merged.map((fact) =>
    HIGHLIGHT.test(fact.label) && fact.value.includes("\n")
      ? { ...fact, label: fact.group === "projects" ? "Project highlights" : "Role highlights" }
      : fact,
  );
}

/**
 * A project reads as one card: its name and stack on the first line, then its
 * bullets. Experience keeps Company/Role/Dates separate because the dates feed
 * the years-of-experience check and the application answers.
 */
export function mergeProjectCards(facts: ProfileFact[]): ProfileFact[] {
  const out: ProfileFact[] = [];

  for (const fact of facts) {
    const isProjectTitle = fact.group === "projects" && !HIGHLIGHT.test(fact.label);
    const isProjectHighlight = fact.group === "projects" && HIGHLIGHT.test(fact.label);
    const last = out[out.length - 1];

    if (isProjectHighlight && last && last.group === "projects") {
      last.value = `${last.value}\n${fact.value}`;
      last.source = uniqueSources([last.source, fact.source]);
      continue;
    }

    if (isProjectTitle) {
      out.push({ ...fact, label: "Project" });
      continue;
    }

    out.push(fact);
  }

  return out;
}

/**
 * One company reads as one card: "Company — Role", the dates, then the bullets.
 *
 * The structured labels are folded into that block on purpose; the consumers that
 * needed them (years-of-experience, form answers) parse the lines back out.
 */
export function mergeExperienceCards(facts: ProfileFact[]): ProfileFact[] {
  const out: ProfileFact[] = [];
  let block: {
    title: string | null;
    company: string | null;
    role: string | null;
    dates: string | null;
    bullets: string[];
    sources: string[];
    confidence: ProfileFact["confidence"];
    group: ProfileFact["group"];
    id: string;
  } | null = null;

  const flush = () => {
    if (!block) return;
    const title = block.title ?? [block.company, block.role].filter(Boolean).join(" — ");

    const lines = [title, block.dates, ...block.bullets.map((bullet) => `• ${bullet}`)].filter(
      (line): line is string => Boolean(line && line.trim()),
    );

    if (lines.length > 0) {
      out.push({
        id: block.id,
        group: block.group,
        label: "Experience",
        value: lines.join("\n"),
        source: uniqueSources(block.sources),
        confidence: block.confidence,
      });
    }

    block = null;
  };

  for (const fact of facts) {
    if (fact.group !== "experience") {
      flush();
      out.push(fact);
      continue;
    }

    const label = fact.label.toLowerCase();
    const startsRole = /company/.test(label) && !/role detail/.test(label);

    if (startsRole) {
      flush();
      block = {
        title: /role and company/i.test(fact.label) ? fact.value : null,
        company: /role and company/i.test(fact.label) ? null : fact.value,
        role: null,
        dates: null,
        bullets: [],
        sources: [fact.source],
        confidence: fact.confidence,
        group: "experience",
        id: fact.id,
      };
      continue;
    }

    if (!block) {
      block = {
        title: null,
        company: null,
        role: null,
        dates: null,
        bullets: [],
        sources: [fact.source],
        confidence: fact.confidence,
        group: "experience",
        id: fact.id,
      };
    } else {
      block.sources.push(fact.source);
    }

    if (/^role$/i.test(fact.label)) {
      block.role = fact.value;
    } else if (/date/i.test(fact.label)) {
      block.dates = fact.value;
    } else {
      block.bullets.push(fact.value);
    }
  }

  flush();
  return out;
}

/** Applied after extraction: one card per role's highlights and per project. */
export function tidyFacts(facts: ProfileFact[]): ProfileFact[] {
  return mergeExperienceCards(mergeProjectCards(mergeHighlights(facts)));
}
