import "server-only";

import type { FactForMatch, MatchResult, RequirementMatch, RequirementStatus } from "@/lib/match/types";

const STOP = new Set([
  "with",
  "that",
  "this",
  "from",
  "have",
  "will",
  "your",
  "you",
  "our",
  "and",
  "the",
  "for",
  "are",
  "not",
  "but",
  "all",
  "any",
  "can",
  "has",
  "use",
  "using",
  "work",
  "working",
  "team",
  "teams",
  "role",
  "job",
  "able",
  "ability",
  "strong",
  "good",
  "plus",
  "etc",
]);

const ELIGIBILITY = /(visa|work authori|sponsor|citizen|permit|salary|compensation|notice period|relocat|years of experience)/i;

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP.has(word));
}

function countsFor(requirements: RequirementMatch[]): Record<RequirementStatus, number> {
  const counts: Record<RequirementStatus, number> = { match: 0, partial: 0, gap: 0, unknown: 0 };
  for (const requirement of requirements) counts[requirement.status] += 1;
  return counts;
}

/**
 * Deterministic fallback used when the model is unavailable.
 *
 * It only claims what word overlap can support, and it never guesses about
 * eligibility: those stay "unknown" so the candidate answers them.
 */
export function matchWithRules(description: string, facts: FactForMatch[]): MatchResult {
  const lines = description
    .split("\n")
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter((line) => line.length >= 30 && line.length <= 240);

  const chosen = lines
    .filter(
      (line) =>
        /\b(experience|proficien|knowledge|degree|bachelor|master|familiar|years|ability|strong|excellent|understanding|skills?)\b/i.test(
          line,
        ),
    )
    .slice(0, 14);

  const factTokens = new Set(tokens(facts.map((fact) => fact.value).join(" ")).map((word) => word.replace(/[.]$/, "")));

  const requirements: RequirementMatch[] = chosen.map((line, index) => {
    const words = tokens(line).map((word) => word.replace(/[.]$/, ""));
    const unique = [...new Set(words)];
    const hits = unique.filter((word) => factTokens.has(word));

    let status: RequirementStatus =
      unique.length === 0 ? "unknown" : hits.length / unique.length >= 0.5 ? "match" : hits.length > 0 ? "partial" : "gap";

    if (ELIGIBILITY.test(line)) status = "unknown";

    const evidenceFact = hits.length
      ? facts.find((fact) => {
          const valueTokens = new Set(tokens(fact.value));
          return hits.some((hit) => valueTokens.has(hit));
        })
      : undefined;

    return {
      id: `req.${index + 1}`,
      text: line.length > 160 ? `${line.slice(0, 157)}…` : line,
      source: line.slice(0, 220),
      importance: /\b(must|required|minimum)\b/i.test(line) ? "must" : "nice",
      status,
      evidence: status === "unknown" ? null : evidenceFact?.value.slice(0, 220) ?? null,
      note: "Matched by word overlap only — no model was used for this line.",
    };
  });

  return {
    requirements,
    counts: countsFor(requirements),
    method: "rules",
    generatedAt: new Date().toISOString(),
  };
}
