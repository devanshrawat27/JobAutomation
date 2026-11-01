import "server-only";

import { z } from "zod";

import { generateJson } from "@/lib/ai/gemini";

export type CoverLetterFact = {
  key: string;
  group: string;
  label: string;
  value: string;
};

export type CoverLetterInput = {
  title: string;
  company: string;
  description: string;
  facts: CoverLetterFact[];
  /** Reviewer notes to apply on a regeneration. */
  fixes?: string[];
};

export type CoverLetterParagraph = { text: string; factKeys: string[] };

export type CoverLetterResult = {
  subject: string;
  paragraphs: CoverLetterParagraph[];
  greeting: string;
  closing: string;
  content: string;
  citedKeys: string[];
  flags: string[];
};

const responseSchema = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING" },
    greeting: { type: "STRING" },
    paragraphs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          factIds: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["text", "factIds"],
      },
    },
    closing: { type: "STRING" },
  },
  required: ["subject", "greeting", "paragraphs", "closing"],
} as const;

const modelResponse = z.object({
  subject: z.string().max(160),
  greeting: z.string().max(160),
  paragraphs: z
    .array(z.object({ text: z.string().min(10).max(1200), factIds: z.array(z.string()).max(20) }))
    .min(1)
    .max(6),
  closing: z.string().max(160),
});

const SYSTEM = `You write a short, specific cover letter for one job using only the candidate facts provided.
Rules you must never break:
- Use only the facts given. Never invent employers, dates, metrics, skills, degrees or eligibility.
- Never add a number that is not in the facts you cite (percentages, years, counts, ranks, dates).
- Do not claim a skill the facts do not state.
- No generic flattery, no "I am writing to express my interest", no promises about the employer.
- 170 to 230 words across at most three body paragraphs.
- Each body paragraph lists the fact ids it relies on.
Return JSON only.`;

function buildPrompt(input: CoverLetterInput): string {
  const facts = input.facts
    .map((fact, index) => `[F${index + 1}] (${fact.group}) ${fact.label}: ${fact.value}`)
    .join("\n");

  const fixes = (input.fixes ?? [])
    .filter(Boolean)
    .slice(0, 8)
    .map((fix) => `- ${fix}`)
    .join("\n");

  return `JOB: ${input.title} at ${input.company}

JOB TEXT (for context only, never copy claims from it):
<<<JOB
${input.description.slice(0, 8000)}
JOB>>>

CANDIDATE FACTS (authoritative, nothing else is known):
<<<FACTS
${facts.slice(0, 12_000)}
FACTS>>>
${
  fixes
    ? `\nA reviewer asked for these fixes. Apply them without adding any fact that is not above:\n${fixes}\n`
    : ""
}
Write the letter. Reference the candidate's own name from the facts if it is there. Address the hiring team unless the job text names a person.`;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,.]*/g) ?? []).map((token) => token.replace(/[.,]$/, ""));
}

/**
 * Fact guard: a body paragraph survives only when it cites real facts and every
 * number in it appears in the facts it cites.
 */
export function guardParagraph(
  text: string,
  factIds: string[],
  byId: Map<string, CoverLetterFact>,
): { ok: true; factKeys: string[] } | { ok: false; reason: string } {
  const cited = factIds.map((id) => byId.get(id)).filter((fact): fact is CoverLetterFact => Boolean(fact));

  if (cited.length === 0) return { ok: false, reason: "No confirmed fact was cited." };

  const citedText = collapse(cited.map((fact) => fact.value).join(" ")).toLowerCase();
  const missing = numbersIn(text).filter((number) => !citedText.includes(number.toLowerCase()));

  if (missing.length > 0) {
    return { ok: false, reason: `Unsupported number(s): ${missing.slice(0, 3).join(", ")}.` };
  }

  return { ok: true, factKeys: cited.map((fact) => fact.key) };
}

export async function writeCoverLetter(input: CoverLetterInput): Promise<CoverLetterResult> {
  let lastError: unknown;

  // One retry: model output occasionally misses the schema or the fact guard.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await writeOnce(input);
    } catch (error) {
      lastError = error;
      console.error(
        `Cover letter attempt ${attempt + 1} failed`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error("cover letter generation failed");
}

async function writeOnce(input: CoverLetterInput): Promise<CoverLetterResult> {
  const byId = new Map(input.facts.map((fact, index) => [`F${index + 1}`, fact]));

  const raw = await generateJson<unknown>({
    system: SYSTEM,
    prompt: buildPrompt(input),
    schema: responseSchema,
    maxOutputTokens: 2048,
  });

  const parsed = modelResponse.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "Cover letter schema issues",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
    throw new Error("cover letter response did not match the schema");
  }

  const flags: string[] = [];
  const paragraphs: CoverLetterParagraph[] = [];
  const cited = new Set<string>();

  parsed.data.paragraphs.forEach((paragraph, index) => {
    const guarded = guardParagraph(paragraph.text, paragraph.factIds, byId);
    if (!guarded.ok) {
      flags.push(`Paragraph ${index + 1} removed — ${guarded.reason}`);
      return;
    }
    guarded.factKeys.forEach((key) => cited.add(key));
    paragraphs.push({ text: collapse(paragraph.text), factKeys: guarded.factKeys });
  });

  if (paragraphs.length === 0) throw new Error("no paragraph passed the fact guard");

  const nameFact = [...byId.values()].find((fact) => /full name/i.test(fact.label));
  const signature = nameFact ? `\n\n${nameFact.value}` : "";
  const content = [parsed.data.greeting, ...paragraphs.map((paragraph) => paragraph.text), parsed.data.closing]
    .filter(Boolean)
    .join("\n\n") + signature;

  return {
    subject: collapse(parsed.data.subject) || `Application for ${input.title}`,
    paragraphs,
    greeting: collapse(parsed.data.greeting),
    closing: collapse(parsed.data.closing),
    content,
    citedKeys: [...cited],
    flags,
  };
}
