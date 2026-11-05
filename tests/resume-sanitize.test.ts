import test from "node:test";
import assert from "node:assert/strict";

import { proposeFactsFromResume } from "../src/lib/resume/propose-facts.ts";
import { sanitizeProposal } from "../src/lib/resume/sanitize.ts";
import type { ResumeProposal } from "../src/lib/resume/propose-facts.ts";

function proposal(overrides: Partial<ResumeProposal> = {}): ResumeProposal {
  return {
    documentName: "resume.pdf",
    groups: ["contact"],
    facts: [],
    openQuestions: [],
    method: "ai",
    ...overrides,
  };
}

test("a bare LinkedIn or GitHub label is not written as the profile value", () => {
  const result = sanitizeProposal(
    proposal({
      facts: [
        { id: "contact.linkedin", group: "contact", label: "LinkedIn", value: "LinkedIn", source: "LinkedIn", confidence: "high" },
        { id: "contact.github", group: "contact", label: "GitHub", value: "GitHub", source: "GitHub", confidence: "high" },
        { id: "contact.website", group: "contact", label: "Portfolio", value: "Portfolio", source: "Portfolio", confidence: "high" },
      ],
    }),
  );

  assert.deepEqual(result.facts, []);
});

test("real profile URLs survive the same filter", () => {
  const result = sanitizeProposal(
    proposal({
      facts: [
        { id: "contact.linkedin", group: "contact", label: "LinkedIn", value: "linkedin.com/in/devansh", source: "linkedin.com/in/devansh", confidence: "high" },
        { id: "contact.github", group: "contact", label: "GitHub", value: "github.com/devansh", source: "github.com/devansh", confidence: "high" },
        { id: "contact.website", group: "contact", label: "Portfolio", value: "devansh.dev", source: "devansh.dev", confidence: "high" },
      ],
    }),
  );

  assert.equal(result.facts.length, 3);
});

test("extractor questions are rewritten in the second person", () => {
  const result = sanitizeProposal(
    proposal({
      openQuestions: [
        "What is the candidate's current city?",
        "What is the candidate's work authorization status?",
        "What is the candidate's notice period?",
        "What is the candidate's expected salary?",
      ],
    }),
  );

  for (const question of result.openQuestions) {
    assert.ok(!/candidate/i.test(question), question);
  }
  assert.equal(new Set(result.openQuestions).size, result.openQuestions.length);
});

test("a date on its own line does not become the employer", () => {
  const text = [
    "EXPERIENCE",
    "Acme Labs - Backend Intern",
    "Jan 2025 - Jul 2025",
    "- Built REST APIs in TypeScript.",
  ].join("\n");

  const proposal = proposeFactsFromResume(text, "resume.docx");
  const experience = proposal.facts.filter((fact) => fact.group === "experience");
  const merged = experience.map((fact) => fact.value).join("\n");

  assert.equal(experience.length, 1);
  assert.match(merged, /^Acme Labs/);
  assert.match(merged, /Backend Intern/);
});
