/**
 * A deterministic ATS read of a generated resume.
 *
 * This is not a prediction of what a specific vendor will do. It counts the
 * things applicant tracking systems and recruiter screens actually fail on:
 * missing contact details, missing sections, no dates, no numbers, pronouns,
 * and length. Every point is traceable to a rule, so the score can be argued
 * with — unlike a model's opinion.
 */

export type AtsStatus = "pass" | "warn" | "fail";

export type AtsCheck = {
  id: string;
  label: string;
  status: AtsStatus;
  detail: string;
  points: number;
  max: number;
};

export type AtsReport = {
  score: number;
  grade: "strong" | "fair" | "weak";
  checks: AtsCheck[];
  summary: string;
};

export type ResumeShape = {
  headline?: string;
  summary?: string;
  sections?: Array<{ title: string; lines?: string[] }>;
};

const ACTION_VERBS = [
  "built", "led", "shipped", "designed", "reduced", "improved", "migrated", "launched",
  "automated", "implemented", "developed", "created", "owned", "scaled", "cut", "grew",
  "delivered", "optimised", "optimized", "refactored", "integrated", "tested", "mentored",
];

function bullets(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-•*]\s+/.test(line))
    .map((line) => line.replace(/^[-•*]\s+/, ""));
}

function words(content: string): string[] {
  return content.split(/\s+/).filter(Boolean);
}

function hasSection(content: string, shape: ResumeShape | null, names: RegExp): boolean {
  if (shape?.sections?.some((section) => names.test(section.title))) return true;
  return names.test(content);
}

export function checkResume({
  content,
  shape,
  jobSkills = [],
}: {
  content: string;
  shape?: ResumeShape | null;
  jobSkills?: string[];
}): AtsReport {
  const body = content.trim();
  const lines = bullets(body);
  const lower = body.toLowerCase();
  const checks: AtsCheck[] = [];

  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(body);
  const phone = /(\+?\d[\d\s-]{8,}\d)/.test(body);
  checks.push({
    id: "contact",
    label: "Contact details",
    status: email && phone ? "pass" : email || phone ? "warn" : "fail",
    detail: email && phone ? "Email and phone are both present." : email ? "A phone number is missing." : phone ? "An email address is missing." : "Neither an email nor a phone number was found.",
    points: email && phone ? 12 : email || phone ? 7 : 0,
    max: 12,
  });

  const sections = [
    hasSection(body, shape ?? null, /experience|employment|work history/i),
    hasSection(body, shape ?? null, /education|degree|academic/i),
    hasSection(body, shape ?? null, /skill|technolog|stack/i),
  ].filter(Boolean).length;
  checks.push({
    id: "sections",
    label: "Standard sections",
    status: sections === 3 ? "pass" : sections === 2 ? "warn" : "fail",
    detail: `${sections} of 3 sections found (experience, education, skills).`,
    points: sections * 7,
    max: 21,
  });

  const dated = /\b(19|20)\d{2}\b[\s\S]{0,24}\b(present|current|(19|20)\d{2})\b/i.test(body);
  checks.push({
    id: "dates",
    label: "Dated roles",
    status: dated ? "pass" : "fail",
    detail: dated ? "At least one role carries a start and end date." : "No date range found — ATS timelines read as missing experience.",
    points: dated ? 12 : 0,
    max: 12,
  });

  const quantified = lines.filter((line) => /\d/.test(line)).length;
  const ratio = lines.length === 0 ? 0 : quantified / lines.length;
  const quantStatus: AtsStatus = ratio >= 0.4 ? "pass" : ratio >= 0.2 ? "warn" : "fail";
  checks.push({
    id: "numbers",
    label: "Quantified bullets",
    status: quantStatus,
    detail: lines.length === 0 ? "No bullet lines found." : `${quantified} of ${lines.length} bullets carry a number.`,
    points: Math.round(ratio * 14),
    max: 14,
  });

  const verbStarts = lines.filter((line) => ACTION_VERBS.some((verb) => line.toLowerCase().startsWith(verb))).length;
  const verbRatio = lines.length === 0 ? 0 : verbStarts / lines.length;
  checks.push({
    id: "verbs",
    label: "Strong openers",
    status: verbRatio >= 0.5 ? "pass" : verbRatio >= 0.25 ? "warn" : "fail",
    detail: `${verbStarts} of ${lines.length} bullets start with an action verb.`,
    points: Math.round(verbRatio * 10),
    max: 10,
  });

  const pronouns = (body.match(/\b(i|me|my|mine)\b/gi) ?? []).length;
  checks.push({
    id: "pronouns",
    label: "No first person",
    status: pronouns === 0 ? "pass" : pronouns <= 2 ? "warn" : "fail",
    detail: pronouns === 0 ? "No first-person pronouns." : `${pronouns} first-person pronoun${pronouns === 1 ? "" : "s"} found.`,
    points: pronouns === 0 ? 8 : pronouns <= 2 ? 4 : 0,
    max: 8,
  });

  const count = words(body).length;
  const lengthStatus: AtsStatus = count >= 250 && count <= 850 ? "pass" : count >= 150 && count <= 1100 ? "warn" : "fail";
  checks.push({
    id: "length",
    label: "One-page length",
    status: lengthStatus,
    detail: `${count} words. A one-page technical resume usually lands between 300 and 750.`,
    points: lengthStatus === "pass" ? 8 : lengthStatus === "warn" ? 4 : 0,
    max: 8,
  });

  const matched = jobSkills.filter((skill) => lower.includes(skill.toLowerCase()));
  const coverage = jobSkills.length === 0 ? null : matched.length / jobSkills.length;
  checks.push({
    id: "keywords",
    label: "Keywords from the posting",
    status: coverage === null ? "warn" : coverage >= 0.6 ? "pass" : coverage >= 0.3 ? "warn" : "fail",
    detail:
      coverage === null
        ? "This document is not tied to a posting with named skills."
        : `${matched.length} of ${jobSkills.length} named skills appear: ${matched.slice(0, 6).join(", ") || "none"}.`,
    points: coverage === null ? 0 : Math.round(coverage * 15),
    max: 15,
  });

  const score = Math.round(checks.reduce((sum, check) => sum + check.points, 0));
  const grade: AtsReport["grade"] = score >= 80 ? "strong" : score >= 55 ? "fair" : "weak";
  const failed = checks.filter((check) => check.status === "fail");

  return {
    score,
    grade,
    checks,
    summary:
      failed.length === 0
        ? "No blocking issues found. Read it once more for meaning."
        : `${failed.length} thing${failed.length === 1 ? "" : "s"} to fix: ${failed.map((check) => check.label.toLowerCase()).join(", ")}.`,
  };
}
