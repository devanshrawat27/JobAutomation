import "server-only";

import { z } from "zod";

import { generateJson } from "@/lib/ai/gemini";

export type ReviewIssue = {
  severity: "high" | "medium" | "low";
  /** The sentence in the draft this is about. */
  quote: string;
  problem: string;
  fix: string;
};

export type DocumentReview = {
  verdict: "ok" | "needs-work";
  issues: ReviewIssue[];
  checkedAt: string;
};

const responseSchema = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["ok", "needs-work"] },
    issues: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          severity: { type: "STRING", enum: ["high", "medium", "low"] },
          quote: { type: "STRING" },
          problem: { type: "STRING" },
          fix: { type: "STRING" },
        },
        required: ["severity", "quote", "problem", "fix"],
      },
    },
  },
  required: ["verdict", "issues"],
} as const;

const modelResponse = z.object({
  verdict: z.enum(["ok", "needs-work"]),
  issues: z
    .array(
      z.object({
        severity: z.enum(["high", "medium", "low"]),
        quote: z.string().max(300),
        problem: z.string().max(300),
        fix: z.string().max(300),
      }),
    )
    .max(12),
});

const SYSTEM_COVER_LETTER = `You review a cover letter against the candidate's confirmed facts and the job.
Look for: claims that the facts do not support, numbers that are not in the facts, generic filler, repetition, and a mismatch with the role.
Do not rewrite the letter. Do not invent problems. If it is sound, answer verdict "ok" with no issues.
Return JSON only.`;

const SYSTEM_RESUME = `You review a job-targeted resume against the candidate's confirmed facts.
Look for: claims that the facts do not support, numbers that are not in the facts, duplicated lines, missing dates on roles, inconsistent tense, and lines that do not help for this role.
Do not rewrite the resume. Do not invent problems. If it is sound, answer verdict "ok" with no issues.
Return JSON only.`;

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Only keep notes whose quoted sentence really appears in the draft. */
export function groundIssues(issues: ReviewIssue[], content: string): ReviewIssue[] {
  const haystack = collapse(content).toLowerCase();
  return issues.filter((issue) => {
    const quote = collapse(issue.quote).toLowerCase();
    return quote.length >= 8 && haystack.includes(quote);
  });
}

export type ReviewKind = "cover-letter" | "resume";

export async function reviewDocument(
  content: string,
  facts: { label: string; value: string }[],
  jobTitle: string,
  kind: ReviewKind = "cover-letter",
): Promise<DocumentReview> {
  const factLines = facts.map((fact) => `- ${fact.label}: ${fact.value}`).join("\n").slice(0, 10_000);

  const raw = await generateJson<unknown>({
    system: kind === "resume" ? SYSTEM_RESUME : SYSTEM_COVER_LETTER,
    prompt: `ROLE: ${jobTitle}

DRAFT:
<<<DRAFT
${content.slice(0, 10_000)}
DRAFT>>>

CONFIRMED FACTS (the only things the candidate can claim):
<<<FACTS
${factLines}
FACTS>>>

Report problems with the exact sentence each one is about. Leave issues empty when the draft is sound.`,
    schema: responseSchema,
    maxOutputTokens: 1500,
  });

  const parsed = modelResponse.safeParse(raw);
  if (!parsed.success) throw new Error("review response did not match the schema");

  const issues = groundIssues(parsed.data.issues, content);
  const hasHigh = issues.some((issue) => issue.severity === "high");

  return {
    verdict: hasHigh || issues.length >= 4 ? "needs-work" : parsed.data.issues.length === 0 ? "ok" : "needs-work",
    issues,
    checkedAt: new Date().toISOString(),
  };
}
