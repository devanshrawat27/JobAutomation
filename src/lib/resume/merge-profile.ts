/**
 * Merging a second resume into a saved profile.
 *
 * Keys are positional (`experience.1`, `projects.2`), so they cannot be trusted
 * to mean the same thing across two documents. Identity is taken from the card
 * itself instead: the company/role line for experience, the project name for
 * projects, and the stable key for everything else. That way a new upload adds
 * what is new, refreshes what it recognises, and never deletes a fact the user
 * confirmed earlier.
 */

export type MergeIncomingFact = {
  key: string;
  groupId: string;
  label: string;
  value: string;
  sourceText: string;
  confidence: string;
  status: string;
  hint?: string | null;
};

export type MergeExistingFact = {
  id: string;
  key: string;
  groupId: string;
  label: string;
  value: string;
};

export type MergePlan = {
  create: MergeIncomingFact[];
  update: Array<{ id: string; fact: MergeIncomingFact }>;
  unchanged: number;
};

export function normalizeFactValue(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Words that carry no meaning when comparing two labels. */
const LABEL_NOISE = new Set(["and", "or", "the", "with", "of", "in", "for", "a", "an"]);

/** Which saved card an incoming card is the same thing as. */
export function factIdentity(fact: {
  groupId: string;
  key: string;
  label?: string;
  value: string;
}): string {
  const firstLine = fact.value.split("\n")[0]?.replace(/\s+/g, " ").trim() ?? "";

  // Cards are matched by what they say, because positional keys can point at a
  // different company or project in a second document.
  if (fact.groupId === "experience" && firstLine) {
    return `experience:${firstLine.toLowerCase()}`;
  }
  if (fact.groupId === "projects" && firstLine) {
    return `projects:${firstLine.toLowerCase()}`;
  }

  // Everything else is matched by label, so a resume read by text rules and the
  // same detail read by the model still land on one card. Only the first
  // meaningful word counts, because the two extractors word labels differently
  // ("Degree" vs "Degree and discipline").
  const label = (fact.label ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .find((word) => word && !LABEL_NOISE.has(word));
  return label ? `label:${fact.groupId}:${label}` : `key:${fact.key}`;
}

/**
 * What a second upload would do to the saved profile: add unseen cards, refresh
 * cards it recognises, leave identical cards untouched, and delete nothing.
 */
export function planMerge(
  existing: MergeExistingFact[],
  incoming: MergeIncomingFact[],
): MergePlan {
  const byIdentity = new Map<string, MergeExistingFact>();
  for (const fact of existing) byIdentity.set(factIdentity(fact), fact);

  const usedKeys = new Set(existing.map((fact) => fact.key));
  const plan: MergePlan = { create: [], update: [], unchanged: 0 };

  for (const fact of incoming) {
    const match = byIdentity.get(factIdentity(fact));

    if (!match) {
      // A positional key can belong to a different card after a second resume.
      let key = fact.key;
      let suffix = 2;
      while (usedKeys.has(key)) key = `${fact.key}~${suffix++}`;
      usedKeys.add(key);
      plan.create.push({ ...fact, key });
      continue;
    }

    if (normalizeFactValue(match.value) === normalizeFactValue(fact.value)) {
      plan.unchanged += 1;
      continue;
    }

    plan.update.push({ id: match.id, fact });
  }

  return plan;
}
