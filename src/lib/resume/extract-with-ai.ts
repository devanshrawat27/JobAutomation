import "server-only";

import { z } from "zod";

import { generateJson } from "@/lib/ai/gemini";
import type { FactGroupId, ProfileFact } from "@/lib/profile-facts";
import type { ResumeProposal } from "@/lib/resume/propose-facts";
import { tidyFacts } from "@/lib/resume/merge-facts";

const GROUPS: FactGroupId[] = ["contact", "education", "experience", "projects", "skills", "achievements"];

const responseSchema = {
  type: "OBJECT",
  properties: {
    facts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          groupId: { type: "STRING", enum: GROUPS },
          label: { type: "STRING" },
          value: { type: "STRING" },
          source: { type: "STRING" },
          confidence: { type: "STRING", enum: ["high", "medium", "low"] },
          hint: { type: "STRING" },
        },
        required: ["groupId", "label", "value", "source", "confidence"],
      },
    },
    openQuestions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["facts", "openQuestions"],
} as const;

const modelFact = z.object({
  groupId: z.enum(["contact", "education", "experience", "projects", "skills", "achievements"]),
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(1900),
  source: z.string().min(2).max(400),
  confidence: z.enum(["high", "medium", "low"]),
  hint: z.string().max(400).optional(),
});

const modelResponse = z.object({
  facts: z.array(modelFact).max(120),
  openQuestions: z.array(z.string().min(3).max(220)).max(10),
});

const SYSTEM = `You extract structured facts from a candidate's resume.
Rules you must never break:
- Use only text that appears in the resume. Never add, guess or "improve" a fact.
- "source" must be copied character-for-character from the resume (one or two lines).
- "value" may be tidied (split company/role/dates, normalise spacing), but it must not add information.
- If a field is not stated, leave it out and mention the gap in openQuestions instead.
Return JSON only.`;

function buildPrompt(resumeText: string): string {
  return `Resume text:
<<<RESUME
${resumeText.slice(0, 20_000)}
RESUME>>>

Extract facts into these groups: contact, education, experience, projects, skills, achievements.

Guidance:
- contact: full name, email, phone, city, profile links only when the text states them.
- education: institution, degree and discipline, grade with its scale as written, graduation year.
- experience: for each role emit Company, Role and Dates separately, then up to 3 Highlight facts quoted from the bullets.
- projects: project name with stack, then up to 3 Highlight facts quoted from the bullets.
- skills: one Skills fact per logical line, keeping the original labels.
- achievements: one Achievements fact, or one per award if they are distinct.
- confidence: high when the text states it directly, medium when it depends on layout or a date range, low when uncertain.
- openQuestions: only things a job application needs that the resume does not state (current city, work authorisation, notice period, URLs hidden behind link text, expected salary). Do not put facts here.`;
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

function slug(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `ai.${base || "fact"}.${index}`;
}

/**
 * Grounding guard: a fact survives only if its quoted source really appears in
 * the resume text. Anything else is treated as a model invention and dropped.
 */
function isGrounded(source: string, haystack: string, looseHaystack: string): boolean {
  const exact = collapse(source);
  if (exact.length >= 3 && haystack.includes(exact)) return true;

  const loose = alphanumeric(source);
  return loose.length >= 12 && looseHaystack.includes(loose.slice(0, 80));
}

export async function extractWithAi(resumeText: string, documentName: string): Promise<ResumeProposal> {
  const raw = await generateJson<unknown>({
    system: SYSTEM,
    prompt: buildPrompt(resumeText),
    schema: responseSchema,
  });

  const parsed = modelResponse.safeParse(raw);
  if (!parsed.success) throw new Error("model response did not match the schema");

  const haystack = collapse(resumeText);
  const looseHaystack = alphanumeric(resumeText);
  const seen = new Set<string>();
  const facts: ProfileFact[] = [];

  parsed.data.facts.forEach((fact, index) => {
    if (!isGrounded(fact.source, haystack, looseHaystack)) return;

    const key = `${fact.groupId}|${collapse(fact.label)}|${collapse(fact.value)}`;
    if (seen.has(key)) return;
    seen.add(key);

    facts.push({
      id: slug(fact.label, index + 1),
      group: fact.groupId,
      label: fact.label.trim(),
      value: fact.value.trim(),
      source: cleanSpace(fact.source).slice(0, 220),
      confidence: fact.confidence,
      ...(fact.hint ? { hint: fact.hint.trim() } : {}),
    });
  });

  if (facts.length < 3) throw new Error("too few grounded facts");

  const merged = tidyFacts(facts);
  const groups = GROUPS.filter((group) => merged.some((fact) => fact.group === group));

  return {
    documentName,
    groups,
    facts: merged.slice(0, 80),
    openQuestions: [...new Set(parsed.data.openQuestions.map((question) => question.trim()))].slice(0, 6),
    method: "ai",
  };
}
