import "server-only";

import { aiExtractionEnabled } from "@/lib/ai/gemini";
import { formatMonths, parseDateRange, requiredYears, totalMonths, type DateRange } from "@/lib/match/experience";
import { matchWithAi } from "@/lib/match/ai";
import { matchWithRules } from "@/lib/match/rules";
import type { FactForMatch, MatchResult, RequirementMatch, RequirementStatus } from "@/lib/match/types";

const TTL_MS = 30 * 60 * 1000;
/** A page must not wait on a model for 45 seconds. After this, use word overlap. */
const AI_MATCH_TIMEOUT_MS = 9_000;

type CacheEntry = { result: MatchResult; at: number };
const cache = new Map<string, CacheEntry>();

export type MatchInput = {
  userId: string;
  postingId: string;
  title: string;
  description: string;
  facts: FactForMatch[];
};

export function clearMatchCache(userId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) cache.delete(key);
  }
}

function countByStatus(requirements: RequirementMatch[]): Record<RequirementStatus, number> {
  const counts: Record<RequirementStatus, number> = { match: 0, partial: 0, gap: 0, unknown: 0 };
  for (const requirement of requirements) counts[requirement.status] += 1;
  return counts;
}

/**
 * Decide "N+ years" requirements from the dates in the profile, not from the
 * model. Overlapping roles are merged so concurrent work is not double-counted.
 */
export function applyExperienceCheck(result: MatchResult, facts: FactForMatch[]): MatchResult {
  const dated: Array<{ text: string; range: DateRange }> = [];

  for (const fact of facts) {
    if (fact.group !== "experience") continue;

    // Dates may sit on their own line inside a merged "Company — Role" card.
    for (const line of fact.value.split("\n")) {
      const candidate = line.trim();
      if (!candidate) continue;
      const range = parseDateRange(candidate);
      if (range) dated.push({ text: candidate, range });
    }
  }

  if (dated.length === 0) return result;

  const months = totalMonths(dated.map((entry) => entry.range));
  const quote = dated.map((entry) => entry.text).join(" · ").slice(0, 220);

  let overridden = false;
  const requirements = result.requirements.map((requirement) => {
    const years = requiredYears(`${requirement.text} ${requirement.source}`);
    if (years === null) return requirement;

    overridden = true;
    const enough = months >= years * 12;

    return {
      ...requirement,
      status: (enough ? "match" : "gap") as RequirementStatus,
      evidence: quote,
      note: `Your dated experience adds up to ${formatMonths(months)}; the posting asks for ${years}+ year${
        years === 1 ? "" : "s"
      }. Computed from your dates, not guessed.`,
    };
  });

  if (!overridden) return result;
  return { ...result, requirements, counts: countByStatus(requirements) };
}

/**
 * Compare a posting with the candidate's confirmed facts.
 *
 * Results are cached per user and posting for 30 minutes; saving a new profile
 * clears that user's entries.
 */
export async function matchJob({ userId, postingId, title, description, facts }: MatchInput): Promise<MatchResult> {
  const key = `${userId}:${postingId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.result;

  let result: MatchResult;
  if (aiExtractionEnabled() && description.length >= 200 && facts.length > 0) {
    try {
      result = await Promise.race([
        matchWithAi(title, description, facts),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("match model timed out")), AI_MATCH_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      console.error("AI match failed, using word overlap", error instanceof Error ? error.message : error);
      result = matchWithRules(description, facts);
    }
  } else {
    result = matchWithRules(description, facts);
  }

  result = applyExperienceCheck(result, facts);

  cache.set(key, { result, at: Date.now() });
  return result;
}
