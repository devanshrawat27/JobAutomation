import type { ResumeProposal } from "@/lib/resume/propose-facts";

/**
 * Cleaning the extractor's output before anyone sees it.
 *
 * Resume PDFs often render "LinkedIn", "GitHub" and "Portfolio" as link text
 * with the URL hidden in the annotation layer. A model reading the text layer
 * can mistake the label for the value, which would then be written into the
 * profile. These are dropped. Questions written in the third person are
 * rewritten so the review screen speaks to the candidate.
 */

const LINK_PATTERNS: Record<string, RegExp> = {
  "contact.linkedin": /linkedin\.com\/(in\/)?[a-z0-9]/i,
  "contact.github": /github\.com\/[a-z0-9]/i,
  "contact.website": /(^https?:\/\/|(^|\s)(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/|$))/i,
};

const FRIENDLY_QUESTIONS: Array<[RegExp, string]> = [
  [/current city|where .* based/i, "Your current city, so we can score commutes honestly."],
  [/work authori[sz]ation|sponsorship/i, "Whether you can work outside India, and whether you need sponsorship."],
  [/notice period|start date|earliest start/i, "When you could start — a notice period or a date."],
  [/hidden behind|urls? .*links?|linkedin, github/i, "Paste the LinkedIn, GitHub or portfolio URLs your resume shows only as link text."],
  [/expected salary|salary|ctc/i, "Your expected salary, so postings below it can be filtered out."],
];

export function humanizeQuestion(question: string): string {
  return FRIENDLY_QUESTIONS.find(([pattern]) => pattern.test(question))?.[1] ?? question;
}

export function sanitizeProposal(proposal: ResumeProposal): ResumeProposal {
  const facts = proposal.facts.filter((fact) => {
    const pattern = LINK_PATTERNS[fact.id];
    if (!pattern) return true;
    return pattern.test(fact.value.trim());
  });

  const openQuestions = [...new Set(proposal.openQuestions.map(humanizeQuestion))];

  return { ...proposal, facts, openQuestions };
}
