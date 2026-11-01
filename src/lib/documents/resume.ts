import "server-only";

import { z } from "zod";

import { generateJson } from "@/lib/ai/gemini";
import { unsupportedNumbers } from "@/lib/documents/guard";
import type { CoverLetterFact } from "@/lib/documents/cover-letter";

export type ResumeLine = { text: string; factKeys: string[] };
export type ResumeSection = { title: string; lines: ResumeLine[] };

export type ResumeDocument = {
  headline: string;
  summary: string;
  sections: ResumeSection[];
  citedKeys: string[];
  flags: string[];
  plainText: string;
};

const responseSchema = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    summary: {
      type: "OBJECT",
      properties: { text: { type: "STRING" }, factIds: { type: "ARRAY", items: { type: "STRING" } } },
      required: ["text", "factIds"],
    },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          lines: {
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
        },
        required: ["title", "lines"],
      },
    },
  },
  required: ["headline", "summary", "sections"],
} as const;

const modelResponse = z.object({
  headline: z.string().min(3).max(120),
  summary: z.object({ text: z.string().min(20).max(700), factIds: z.array(z.string()).max(20) }),
  sections: z
    .array(
      z.object({
        title: z.string().min(2).max(60),
        lines: z
          .array(z.object({ text: z.string().min(3).max(400), factIds: z.array(z.string()).max(20) }))
          .max(20),
      }),
    )
    .min(1)
    .max(6),
});

const SYSTEM = `You build a concise, job-targeted resume from a candidate's confirmed facts.
Rules you must never break:
- Use only the facts given. Never invent employers, dates, metrics, skills, degrees or eligibility.
- Never add a number that is not in the facts the line cites.
- Keep the candidate's own wording for achievements; you may shorten without changing meaning.
- Order sections Experience, Projects, Education, Skills. Skip a section that has no facts.
- Each line is short: one role, one project, one degree or one skill group.
Return JSON only.`;

function buildPrompt(
  input: { title: string; company: string; description: string; facts: CoverLetterFact[]; fixes?: string[] },
): string {
  const lines = input.facts
    .map((fact, index) => `[F${index + 1}] (${fact.group}) ${fact.label}: ${fact.value}`)
    .join("\n");

  const fixes = (input.fixes ?? [])
    .filter(Boolean)
    .slice(0, 8)
    .map((fix) => `- ${fix}`)
    .join("\n");

  return `TARGET JOB: ${input.title} at ${input.company}

JOB TEXT (context only — never copy claims from it):
<<<JOB
${input.description.slice(0, 6000)}
JOB>>>

CONFIRMED FACTS (authoritative):
<<<FACTS
${lines.slice(0, 12_000)}
FACTS>>>
${
  fixes
    ? `\nA reviewer asked for these fixes. Apply them without adding any fact that is not above:\n${fixes}\n`
    : ""
}
Build the resume. The headline names the role the candidate is targeting, using only their real level. The summary is two sentences. Every line lists the fact ids it uses.`;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function guardLine(
  text: string,
  factIds: string[],
  byId: Map<string, CoverLetterFact>,
): { ok: true; factKeys: string[] } | { ok: false; reason: string } {
  const cited = factIds.map((id) => byId.get(id)).filter((fact): fact is CoverLetterFact => Boolean(fact));
  if (cited.length === 0) return { ok: false, reason: "no fact cited" };

  const missing = unsupportedNumbers(text, cited.map((fact) => fact.value));
  if (missing.length > 0) return { ok: false, reason: `unsupported number ${missing[0]}` };

  return { ok: true, factKeys: cited.map((fact) => fact.key) };
}

export type ResumeInput = {
  title: string;
  company: string;
  description: string;
  facts: CoverLetterFact[];
  /** Reviewer notes to apply on a regeneration. */
  fixes?: string[];
};

export async function buildResume(input: ResumeInput): Promise<ResumeDocument> {
  const byId = new Map(input.facts.map((fact, index) => [`F${index + 1}`, fact]));
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await buildOnce(input, byId);
    } catch (error) {
      lastError = error;
      console.error(`Resume attempt ${attempt + 1} failed`, error instanceof Error ? error.message : error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("resume generation failed");
}

async function buildOnce(
  input: ResumeInput,
  byId: Map<string, CoverLetterFact>,
): Promise<ResumeDocument> {
  const raw = await generateJson<unknown>({
    system: SYSTEM,
    prompt: buildPrompt(input),
    schema: responseSchema,
    maxOutputTokens: 3072,
  });

  const parsed = modelResponse.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "Resume schema issues",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
    throw new Error("resume response did not match the schema");
  }

  const flags: string[] = [];
  const cited = new Set<string>();

  const summaryGuard = guardLine(parsed.data.summary.text, parsed.data.summary.factIds, byId);
  const summary = summaryGuard.ok ? compact(parsed.data.summary.text) : "";
  if (summaryGuard.ok) summaryGuard.factKeys.forEach((key) => cited.add(key));
  else flags.push(`Summary removed — ${summaryGuard.reason}.`);

  const sections: ResumeSection[] = [];

  for (const section of parsed.data.sections) {
    const lines: ResumeLine[] = [];

    for (const line of section.lines) {
      const guarded = guardLine(line.text, line.factIds, byId);
      if (!guarded.ok) {
        flags.push(`Dropped from ${section.title}: "${compact(line.text).slice(0, 60)}…" — ${guarded.reason}.`);
        continue;
      }
      guarded.factKeys.forEach((key) => cited.add(key));
      lines.push({ text: compact(line.text), factKeys: guarded.factKeys });
    }

    if (lines.length > 0) sections.push({ title: compact(section.title), lines });
  }

  const totalLines = sections.reduce((count, section) => count + section.lines.length, 0);
  if (totalLines < 3) throw new Error("no resume line passed the fact guard");

  const plainText = [
    parsed.data.headline,
    summary,
    ...sections.map((section) => `${section.title}\n${section.lines.map((line) => `• ${line.text}`).join("\n")}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    headline: compact(parsed.data.headline),
    summary,
    sections,
    citedKeys: [...cited],
    flags,
    plainText,
  };
}
