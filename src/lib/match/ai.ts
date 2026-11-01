import "server-only";

import { z } from "zod";

import { generateJson } from "@/lib/ai/gemini";
import { screenForModel, UNTRUSTED_NOTICE } from "@/lib/jobs/guard";
import type { FactForMatch, MatchResult, RequirementMatch, RequirementStatus } from "@/lib/match/types";

const responseSchema = {
  type: "OBJECT",
  properties: {
    requirements: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          source: { type: "STRING" },
          importance: { type: "STRING", enum: ["must", "nice"] },
          status: { type: "STRING", enum: ["match", "partial", "gap", "unknown"] },
          evidence: { type: "STRING" },
          note: { type: "STRING" },
        },
        required: ["text", "source", "importance", "status"],
      },
    },
  },
  required: ["requirements"],
} as const;

const modelResponse = z.object({
  requirements: z
    .array(
      z.object({
        text: z.string().min(3).max(240),
        source: z.string().min(3).max(400),
        importance: z.enum(["must", "nice"]),
        status: z.enum(["match", "partial", "gap", "unknown"]),
        evidence: z.string().max(400).optional(),
        note: z.string().max(240).optional(),
      }),
    )
    .max(40),
});

const SYSTEM = `You compare one job description with a candidate's confirmed profile facts.
Rules you must never break:
- Use only the job text and the facts given. Never invent experience, skills, numbers or eligibility.
- "source" is copied from the job text; it is one contiguous sentence from the posting, with no analysis, labels or notes added to it.
- "evidence" is copied from the facts; leave it empty when nothing supports the requirement.
- status meanings:
  - match: the facts clearly satisfy the requirement, even when the wording differs. Quote the fact that shows it.
  - partial: related evidence exists, but it covers only part of the requirement.
  - gap: the facts show the candidate does not have it.
  - unknown: no fact speaks to the requirement at all.
- A skill listed on the profile satisfies a requirement for that skill or language, even if the sentence names several.
- Prefer "unknown" over guessing. Never produce a score or a hiring prediction.
Return JSON only.`;

function buildPrompt(title: string, description: string, facts: FactForMatch[]): string {
  const factLines = facts.map((fact) => `- [${fact.group}] ${fact.label}: ${fact.value}`).join("\n");
  const screened = screenForModel(description);

  return `JOB TITLE: ${title}

${UNTRUSTED_NOTICE}

JOB TEXT:
<<<JOB
${screened.clean.slice(0, 14_000)}
JOB>>>

CANDIDATE FACTS (confirmed by the candidate, nothing else is known):
<<<FACTS
${factLines.slice(0, 12_000)}
FACTS>>>

List the job's real requirements (aim for 8 to 16, most important first). For each, give the sentence it came from, whether it is a must or nice to have, and how the facts answer it. Include eligibility requirements (degree, years of experience, work authorisation, location) when the job states them.`;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function cleanSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function alphanumeric(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip list markers and prompt tags the model sometimes copies along. */
function stripMarkers(value: string): string {
  return value
    .replace(/^\s*[-•*]\s*/, "")
    .replace(/^\[\s*[a-z_-]+\s*\]\s*/i, "")
    .replace(/^["“]([\s\S]*)["”]$/, "$1")
    .trim();
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

/**
 * When the model composes a sentence from several facts, quote the single fact
 * that covers most of it instead of showing an unverifiable paraphrase.
 */
function bestSupportingFact(evidence: string, facts: FactForMatch[]): FactForMatch | null {
  const wanted = [...new Set(tokens(evidence))];
  if (wanted.length === 0) return null;

  let best: { fact: FactForMatch; score: number } | null = null;
  for (const fact of facts) {
    const have = new Set(tokens(fact.value));
    const hits = wanted.filter((word) => have.has(word)).length;
    const score = hits / wanted.length;
    if (!best || score > best.score) best = { fact, score };
  }

  return best && best.score >= 0.6 ? best.fact : null;
}

/**
 * The whole quote must exist in the source.
 *
 * Long quotes are compared on letters and digits only (so punctuation and
 * spacing differences do not matter). Short quotes such as "SQL" or "Go" must
 * appear as a standalone word, so "Go" is not found inside "Google".
 */
function grounded(quote: string, haystack: string, looseHaystack: string, minExact = 4): boolean {
  const exact = collapse(quote);
  if (exact.length >= minExact && haystack.includes(exact)) return true;

  const loose = alphanumeric(quote);
  if (loose.length < 12) {
    if (loose.length < 2) return false;
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(loose)}([^a-z0-9]|$)`).test(haystack);
  }

  return looseHaystack.includes(loose);
}

function countsFor(requirements: RequirementMatch[]): Record<RequirementStatus, number> {
  const counts: Record<RequirementStatus, number> = { match: 0, partial: 0, gap: 0, unknown: 0 };
  for (const requirement of requirements) counts[requirement.status] += 1;
  return counts;
}

export async function matchWithAi(
  title: string,
  description: string,
  facts: FactForMatch[],
): Promise<MatchResult> {
  const raw = await generateJson<unknown>({
    system: SYSTEM,
    prompt: buildPrompt(title, description, facts),
    schema: responseSchema,
  });

  const parsed = modelResponse.safeParse(raw);
  if (!parsed.success) throw new Error("match response did not match the schema");

  const jobHaystack = collapse(description);
  const jobLoose = alphanumeric(description);
  const factsHaystack = collapse(facts.map((fact) => fact.value).join(" \n "));
  const factsLoose = alphanumeric(facts.map((fact) => fact.value).join(" "));

  const seen = new Set<string>();
  const requirements: RequirementMatch[] = [];

  parsed.data.requirements.forEach((requirement, index) => {
    if (!grounded(requirement.source, jobHaystack, jobLoose)) return;

    const key = collapse(requirement.text);
    if (seen.has(key)) return;
    seen.add(key);

    let status: RequirementStatus = requirement.status;
    let evidence = requirement.evidence?.trim() || null;
    let note = requirement.note?.trim() || null;

    if (evidence) {
      const cleaned = stripMarkers(evidence);

      if (grounded(cleaned, factsHaystack, factsLoose, 2)) {
        evidence = cleaned;
      } else {
        const support = bestSupportingFact(cleaned, facts);
        if (support) {
          evidence = support.value;
          note = note ?? "Closest confirmed fact.";
        } else {
          evidence = null;
          status = "unknown";
          note = "The quoted evidence could not be traced to a confirmed fact.";
        }
      }
    }

    if (!evidence && (status === "match" || status === "partial")) {
      status = "unknown";
      note = note ?? "No confirmed fact supports this yet.";
    }

    requirements.push({
      id: `req.${index + 1}`,
      text: requirement.text.trim(),
      source: stripMarkers(cleanSpace(requirement.source)).slice(0, 220),
      importance: requirement.importance,
      status,
      evidence: evidence ? cleanSpace(evidence).slice(0, 220) : null,
      note,
    });
  });

  if (requirements.length < 3) throw new Error("too few grounded requirements");

  return {
    requirements: requirements.slice(0, 18),
    counts: countsFor(requirements.slice(0, 18)),
    method: "ai",
    generatedAt: new Date().toISOString(),
  };
}
