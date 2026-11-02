import { parseDateRange, totalMonths } from "@/lib/match/experience";

export type AnswerGroup = "contact" | "education" | "experience" | "eligibility" | "preferences";
export type ApplicationAnswer = {
  id: string;
  label: string;
  group: AnswerGroup;
  value: string | null;
  factKey: string | null;
  /** The fact label the value came from, for attribution. */
  sourceLabel: string | null;
  note?: string;
};

type Fact = {
  key: string;
  label: string;
  value: string;
};

type Slot = {
  id: string;
  label: string;
  group: AnswerGroup;
  patterns: RegExp[];
  note?: string;
};

/**
 * The fields most employer forms ask for, in the order they usually appear.
 *
 * Eligibility and availability are listed even when the profile has no answer:
 * those must never be inferred, so they stay visibly missing until the candidate
 * fills them in.
 */
const SLOTS: Slot[] = [
  { id: "contact.fullName", label: "Full name", group: "contact", patterns: [/full name/i, /\bname\b/i] },
  { id: "contact.email", label: "Email", group: "contact", patterns: [/e-?mail/i] },
  { id: "contact.phone", label: "Phone", group: "contact", patterns: [/phone|mobile|contact number/i] },
  { id: "contact.location", label: "Current location", group: "contact", patterns: [/location|city|based in/i] },
  { id: "contact.linkedin", label: "LinkedIn", group: "contact", patterns: [/linkedin/i] },
  { id: "contact.website", label: "Portfolio or website", group: "contact", patterns: [/portfolio|personal (site|website)|other (website|url)/i] },
  { id: "contact.github", label: "GitHub", group: "contact", patterns: [/github|stack\s*overflow/i] },
  { id: "contact.country", label: "Country", group: "contact", patterns: [/^country|country of residence|located in/i] },

  { id: "education.institution", label: "Institution", group: "education", patterns: [/institution|university|college/i] },
  { id: "education.degree", label: "Degree and discipline", group: "education", patterns: [/degree|discipline|course|branch/i] },
  { id: "education.grade", label: "Grade (as stated)", group: "education", patterns: [/grade|cgpa|gpa|percentage|marks/i], note: "Kept in the original scale; never converted." },
  { id: "education.graduation", label: "Graduation", group: "education", patterns: [/graduat|class of|passing|batch/i] },

  { id: "experience.company", label: "Current company", group: "experience", patterns: [/company|employer/i] },
  { id: "experience.role", label: "Current role", group: "experience", patterns: [/\brole\b|job title|designation/i] },
  { id: "experience.dates", label: "Dates", group: "experience", patterns: [/\bdates?\b|duration|period/i] },
  { id: "skills", label: "Skills", group: "experience", patterns: [/skills?/i] },
  { id: "experience.years", label: "Total years of experience", group: "experience", patterns: [/years of experience|total experience/i], note: "Computed from your dated roles, with overlapping months counted once." },

  {
    id: "eligibility.sponsorship",
    label: "Visa sponsorship needed",
    group: "eligibility",
    patterns: [/sponsor(ship)?|require.*visa|visa status/i],
    note: "Asked by most US and EU forms; the product never infers it.",
  },
  {
    id: "eligibility.relocation",
    label: "Willing to relocate",
    group: "eligibility",
    patterns: [/relocat|willing to move|open to moving/i],
  },
  {
    id: "eligibility.authorization",
    label: "Work authorization",
    group: "eligibility",
    patterns: [/work authori|right to work|visa|sponsor/i],
    note: "Country- and job-specific. The product never infers this.",
  },
  {
    id: "eligibility.notice",
    label: "Notice period / earliest start",
    group: "eligibility",
    patterns: [/notice period|earliest start|available to join|availability/i],
    note: "Asked by most employer forms; confirm before you send it.",
  },
  {
    id: "preferences.currentCtc",
    label: "Current compensation",
    group: "preferences",
    patterns: [/current (ctc|salary|compensation)|present salary/i],
    note: "Optional. Many Indian forms ask; you can leave it blank.",
  },
  {
    id: "preferences.salary",
    label: "Expected compensation",
    group: "preferences",
    patterns: [/expected (salary|compensation)|salary expectation/i],
    note: "Optional. Leave blank unless the form requires it.",
  },
  {
    id: "preferences.relocation",
    label: "Willing to relocate",
    group: "preferences",
    patterns: [/relocat/i],
    note: "A preference, not a resume fact.",
  },
];

function match(slot: Slot, facts: Fact[]): Fact | null {
  for (const pattern of slot.patterns) {
    const hit = facts.find((fact) => pattern.test(fact.label) || pattern.test(fact.key));
    if (hit) return hit;
  }
  return null;
}

/**
 * Experience is stored as one card per company: "Company — Role", the dates,
 * then bullets. Pull the first line apart so the company/role/date answers keep
 * working after that merge.
 */
function parseExperienceCard(facts: Fact[]): { company: string; role: string; dates: string } | null {
  const card = facts.find((fact) => /^experience$/i.test(fact.label) && fact.value.includes("\n"));
  if (!card) return null;

  const lines = card.value.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = lines[0] ?? "";
  const [company, ...roleParts] = title.split(/\s+[—–−-]\s+/);

  const dates = lines
    .slice(1)
    .find((line) => /(present|current|\b(19|20)\d{2}\b)/i.test(line) && !line.startsWith("•"));

  return {
    company: company?.trim() ?? "",
    role: roleParts.join(" — ").trim(),
    dates: dates ?? "",
  };
}

export function buildAnswers(facts: Fact[]): ApplicationAnswer[] {
  const mergedCard = facts.find((fact) => /^experience$/i.test(fact.label) && fact.value.includes("\n"));
  const parsed = mergedCard ? parseExperienceCard(facts) : null;

  // Only dated roles count: an education range ("2023 - 2027") is not work.
  const experienceFacts = facts.filter((fact) =>
    /experience|company|role|employee|intern|work history|dates/i.test(fact.label),
  );
  const datesSource = experienceFacts.find((fact) => /date|experience/i.test(fact.label))?.label ?? "your dated roles";

  // Years come from the dates themselves, never from a guess.
  const datedRanges = experienceFacts
    .flatMap((fact) => fact.value.split("\n"))
    .map((line) => parseDateRange(line))
    .filter((range): range is NonNullable<typeof range> => Boolean(range));
  const months = totalMonths(datedRanges);
  const yearsValue = months > 0 ? (Math.round((months / 12) * 10) / 10).toFixed(1) : null;

  return SLOTS.map((slot) => {
    if (slot.id === "experience.years") {
      return {
        id: slot.id,
        label: slot.label,
        group: slot.group,
        value: yearsValue,
        factKey: null,
        sourceLabel: datesSource,
        ...(slot.note ? { note: slot.note } : {}),
      };
    }

    // A merged experience card is the source for company/role/dates, even though
    // its key still carries the name of the fact it started from.
    if (mergedCard && parsed && slot.id.startsWith("experience.")) {
      const value =
        slot.id === "experience.company"
          ? parsed.company
          : slot.id === "experience.role"
            ? parsed.role
            : parsed.dates;

      return {
        id: slot.id,
        label: slot.label,
        group: slot.group,
        value: value || null,
        factKey: mergedCard.key,
        sourceLabel: mergedCard.label,
        ...(slot.note ? { note: slot.note } : {}),
      };
    }

    const fact = match(slot, facts);

    return {
      id: slot.id,
      label: slot.label,
      group: slot.group,
      value: fact?.value ?? null,
      factKey: fact?.key ?? null,
      sourceLabel: fact?.label ?? null,
      ...(slot.note ? { note: slot.note } : {}),
    };
  });
}

export const answerGroupLabels: Record<AnswerGroup, string> = {
  contact: "Contact",
  education: "Education",
  experience: "Experience",
  eligibility: "Eligibility and availability",
  preferences: "Preferences",
};
