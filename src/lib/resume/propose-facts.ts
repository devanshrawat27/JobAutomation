import type { FactConfidence, FactGroupId, ProfileFact } from "@/lib/profile-facts";
import { tidyFacts } from "@/lib/resume/merge-facts";

/**
 * Deterministic first-pass proposal from a resume's text layer.
 *
 * Rules:
 * - Only text that is actually present is proposed; nothing is paraphrased.
 * - Every fact carries the exact line it came from so the reviewer can judge it.
 * - Anything the text layer cannot answer becomes an open question, not a guess.
 *
 * This is intentionally conservative. An LLM extractor can replace it later
 * behind the same return shape.
 */

export type ResumeProposal = {
  documentName: string;
  groups: FactGroupId[];
  facts: ProfileFact[];
  openQuestions: string[];
  /** Which extractor produced these facts. */
  method: "rules" | "ai";
  /** True when the resume text came from OCR of a scanned PDF. */
  ocr?: boolean;
};

const GROUP_ORDER: FactGroupId[] = ["contact", "education", "experience", "projects", "skills", "achievements"];

const HEADING_PATTERNS: Array<[RegExp, FactGroupId]> = [
  [/^education\b/i, "education"],
  [/^(work\s+)?experience\b/i, "experience"],
  [/^projects?\b/i, "projects"],
  [/^(technical\s+)?skills\b/i, "skills"],
  [/^(honou?rs?|achievements?|awards?)\b/i, "achievements"],
];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const BULLET = /^[•·▪◦*\-–—]\s+/;
const YEAR_RANGE = /((?:19|20)\d{2})\s*[–—−-]\s*((?:19|20)\d{2})/;
const DATE_HINT = /(?:19|20)\d{2}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
const DASH_SPLIT = new RegExp("\\s+[–—−-]\\s+");
const GRADE = /(?:cgpa|gpa)\s*[:\-–]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:\/\s*([0-9]+(?:\.[0-9]+)?))?/i;
const DEGREE = /(b\.?\s?tech|b\.?\s?e\.?\b|bachelor|master|m\.?\s?tech|b\.?\s?sc|mba|ph\.?d)/i;
const INSTITUTION = /(university|college|institute|school|academy)/i;

type Section = { group: FactGroupId | "header"; lines: string[] };

function splitLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .replace(/[\uE000-\uF8FF]/g, "") // icon-font glyphs from the PDF text layer
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0);
}

function headingFor(line: string): FactGroupId | null {
  if (line.length > 60) return null;
  const normalized = line.replace(/[:\s]+$/, "");
  for (const [pattern, group] of HEADING_PATTERNS) {
    if (pattern.test(normalized)) return group;
  }
  return null;
}

function buildSections(lines: string[]): Section[] {
  const sections: Section[] = [{ group: "header", lines: [] }];

  for (const line of lines) {
    const group = headingFor(line);
    if (group) {
      sections.push({ group, lines: [] });
      continue;
    }
    sections[sections.length - 1].lines.push(line);
  }

  return sections;
}

function cleanExcerpt(line: string): string {
  return line.replace(/\s+/g, " ").trim().slice(0, 220);
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function findPhone(lines: string[]): string | null {
  for (const line of lines) {
    if (EMAIL.test(line) && line.length < 12) continue;
    const candidates = line.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d[\d\s-]{7,}\d/g) ?? [];
    for (const candidate of candidates) {
      const digits = phoneDigits(candidate);
      // Reject year ranges and short numbers; Indian and international numbers
      // both sit between 10 and 15 digits.
      if (digits.length >= 10 && digits.length <= 15 && !/^(19|20)\d{2}(19|20)\d{2}$/.test(digits)) {
        return candidate.trim();
      }
    }
  }
  return null;
}

function stripBullet(line: string): string {
  return line.replace(BULLET, "").trim();
}

function yearRange(line: string): { start: string; end: string } | null {
  const match = line.match(YEAR_RANGE);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

const DATE_RANGE_AT_END =
  /((?:[A-Z][a-z]{2,8}\.?\s+)?(?:19|20)\d{2})\s*[–—−-]\s*(present|current|(?:[A-Z][a-z]{2,8}\.?\s+)?(?:19|20)\d{2})\s*$/i;
const SINGLE_DATE_AT_END = /((?:[A-Z][a-z]{2,8}\.?\s+)?(?:19|20)\d{2})\s*$/i;
const ROLE_HINT =
  /\b(intern|internship|engineer|engineering|developer|programmer|analyst|manager|designer|consultant|associate|lead|scientist|architect|specialist|coordinator|director)\b/i;
const COMPANY_HINT =
  /\b(technologies|labs|inc|llc|ltd|limited|systems|solutions|pvt|corp|corporation|company|university|institute|studios|group|consulting|services|ventures)\b/i;

function trimSeparators(value: string): string {
  return value.replace(/[\s,;|—–−-]+$/, "").trim();
}

/** Pull a trailing date (range or single) off an experience entry line. */
function splitTrailingDates(line: string): { head: string; dates: string | null } {
  const range = line.match(DATE_RANGE_AT_END);
  if (range?.index !== undefined && range.index > 0) {
    return { head: trimSeparators(line.slice(0, range.index)), dates: range[0].trim() };
  }

  const single = line.match(SINGLE_DATE_AT_END);
  if (single?.index !== undefined && single.index > 0) {
    const head = trimSeparators(line.slice(0, single.index));
    // A year that belongs to the company name ("Microsoft SEFA 2025") is not a date.
    if (ROLE_HINT.test(head) || DASH_SPLIT.test(head)) {
      return { head, dates: single[0].trim() };
    }
  }

  return { head: line, dates: null };
}

const DATE_ONLY = /^\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?\d{4}\s*(?:[-–—]|to)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:\d{4}|present|current)\s*$/i;

/** Split "Company — Role" using corporate suffixes as the only strong signal. */
function splitCompanyRole(head: string): { company: string; role: string } | null {
  const parts = head.split(/\s+[–—−-]\s+/);
  if (parts.length < 2) return null;

  const left = parts[0].trim();
  const right = parts.slice(1).join(" — ").trim();
  if (!left || !right) return null;

  const rightIsCompany = COMPANY_HINT.test(right) && !COMPANY_HINT.test(left);

  if (rightIsCompany) return { company: right, role: left };
  return { company: left, role: right };
}

export function proposeFactsFromResume(text: string, documentName: string): ResumeProposal {
  const lines = splitLines(text);
  const sections = buildSections(lines);
  const section = (group: FactGroupId) => sections.find((entry) => entry.group === group);
  const header = sections[0]?.lines ?? [];

  const facts: ProfileFact[] = [];
  const openQuestions: string[] = [];

  const push = (
    key: string,
    group: FactGroupId,
    label: string,
    value: string,
    source: string,
    confidence: FactConfidence,
    hint?: string,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    // A repeated id would break the review list and the per-user unique key.
    const id = facts.some((fact) => fact.id === key) ? `${key}.${facts.length}` : key;
    facts.push({
      id,
      group,
      label,
      value: trimmed.slice(0, 1900),
      source: cleanExcerpt(source),
      confidence,
      ...(hint ? { hint } : {}),
    });
  };

  // Contact: taken from the header block, never invented.
  const nameLine = header.find(
    (line) => line.length <= 60 && !EMAIL.test(line) && !phoneDigits(line).length && !headingFor(line),
  );
  if (nameLine) push("contact.name", "contact", "Full name", nameLine, nameLine, "high");

  const emailLine = lines.find((line) => EMAIL.test(line));
  const email = emailLine?.match(EMAIL)?.[0];
  if (email && emailLine) push("contact.email", "contact", "Email", email, emailLine, "high");

  const phoneLine = header.find((line) => findPhone([line]));
  const phone = phoneLine ? findPhone([phoneLine]) : findPhone(lines);
  if (phone && phoneLine) push("contact.phone", "contact", "Phone", phone, phoneLine, "high");

  const linkLine = header.find((line) => /\b(linkedin|github|portfolio|coding profile|leetcode)\b/i.test(line));
  if (linkLine) {
    openQuestions.push(
      "The PDF shows LinkedIn, GitHub or portfolio links but the text layer does not contain their URLs. Paste them once and they are reused.",
    );
  }

  // Education
  const education = section("education");
  if (education) {
    const institutionLine = education.lines.find((line) => INSTITUTION.test(line));
    const range = institutionLine ? yearRange(institutionLine) : null;
    if (institutionLine) {
      const institution = range
        ? institutionLine.replace(range.start, "").replace(range.end, "").replace(/[–—−-]/g, "").replace(/\s{2,}/g, " ").replace(/[\s,]+$/, "")
        : institutionLine;
      push("education.institution", "education", "Institution", institution, institutionLine, "high");
    }

    const degreeLine = education.lines.find((line) => DEGREE.test(line));
    if (degreeLine) {
      const gradeMatch = degreeLine.match(GRADE);
      const degree = gradeMatch ? degreeLine.slice(0, gradeMatch.index).replace(/[\s,;|]+$/, "") : degreeLine;
      push("education.degree", "education", "Degree and discipline", degree, degreeLine, "high");

      if (gradeMatch) {
        const [, value, scale] = gradeMatch;
        push(
          "education.grade",
          "education",
          "Grade",
          `CGPA ${value}${scale ? ` / ${scale}` : ""}`,
          degreeLine,
          "high",
          scale
            ? `The ${scale}-point scale is stated on your resume, so it is kept as written and not converted to a percentage.`
            : "No scale is stated next to this grade. Confirm what it is out of before an employer form asks.",
        );
        if (!scale) openQuestions.push("The grade has no scale on the resume. What is it out of?");
      }
    }

    const educationRange = education.lines.join(" ").match(YEAR_RANGE);
    if (educationRange) {
      push(
        "education.graduation",
        "education",
        "Graduation",
        `Class of ${educationRange[2]}`,
        education.lines.find((line) => line.includes(educationRange[2])) ?? educationRange[0],
        "medium",
        "Inferred from the year range on your resume. Confirm the exact month if a form asks for it.",
      );
    }
  }

  // Experience
  const experience = section("experience");
  if (experience) {
    let entryIndex = 0;
    let current: { key: string; bullets: string[]; metaAdded: boolean } | null = null;
    let lastBulletIndex: number | null = null;

    const flushHighlights = () => {
      if (!current) return;
      current.bullets.slice(0, 3).forEach((bullet, index) => {
        push(
          `${current?.key}.h${index + 1}`,
          "experience",
          "Highlight",
          stripBullet(bullet),
          bullet,
          "high",
        );
      });
    };

    let pendingHeading: string | null = null;

    for (const line of experience.lines) {
      const isBullet = BULLET.test(line);
      const split = !isBullet ? splitTrailingDates(line) : { head: "", dates: null };
      const dateOnly = !isBullet && DATE_ONLY.test(line);
      const looksLikeEntry =
        !isBullet && !dateOnly && line.length < 170 && DATE_HINT.test(line) && DASH_SPLIT.test(line) && Boolean(split.head);

      if (looksLikeEntry) {
        flushHighlights();
        entryIndex += 1;
        current = { key: `experience.${entryIndex}`, bullets: [], metaAdded: false };
        lastBulletIndex = null;
        pendingHeading = null;

        const { head, dates } = splitTrailingDates(line);
        const parts = splitCompanyRole(head);

        if (parts) {
          push(`${current.key}.company`, "experience", "Company", parts.company, line, "high");
          push(`${current.key}.role`, "experience", "Role", parts.role, line, "high");
        } else {
          push(current.key, "experience", "Role and company", head, line, "high");
        }
        if (dates) push(`${current.key}.dates`, "experience", "Dates", dates, line, "high");
        continue;
      }

      // Resumes commonly put "Company - Role" and the dates on separate lines.
      // The date-only line belongs to the heading just above it, not to a new
      // employer called "Jan 2025".
      if (dateOnly) {
        if (pendingHeading) {
          entryIndex += 1;
          current = { key: `experience.${entryIndex}`, bullets: [], metaAdded: false };
          lastBulletIndex = null;
          const parts = splitCompanyRole(pendingHeading);
          if (parts) {
            push(`${current.key}.company`, "experience", "Company", parts.company, pendingHeading, "high");
            push(`${current.key}.role`, "experience", "Role", parts.role, pendingHeading, "high");
          } else {
            push(current.key, "experience", "Role and company", pendingHeading, pendingHeading, "high");
          }
          push(`${current.key}.dates`, "experience", "Dates", line.trim(), line, "high");
          pendingHeading = null;
          continue;
        }
        if (current) {
          // The entry already carried its dates (same line); nothing to add.
          continue;
        }
        continue;
      }

      if (!current) {
        if (!isBullet && DASH_SPLIT.test(line) && line.length < 120 && !DATE_HINT.test(line)) {
          pendingHeading = line;
        }
        continue;
      }

      if (isBullet) {
        current.bullets.push(line);
        lastBulletIndex = current.bullets.length - 1;
        continue;
      }

      // PDF wrapping puts the rest of a bullet on the next line. Join it back
      // instead of inventing a new fact from a sentence fragment.
      const previous = lastBulletIndex === null ? null : current.bullets[lastBulletIndex];
      const continuesBullet =
        previous !== null && (previous.endsWith(",") || /^[a-z(]/.test(line));

      if (continuesBullet && lastBulletIndex !== null) {
        current.bullets[lastBulletIndex] = `${current.bullets[lastBulletIndex]} ${line}`.trim();
        continue;
      }

      // One title/location line (for example "Remote") before the bullets.
      if (!current.metaAdded && line.length < 120 && !DATE_HINT.test(line)) {
        current.metaAdded = true;
        push(`${current.key}.meta`, "experience", "Role detail", line, line, "medium");
      }
    }

    if (pendingHeading) {
      entryIndex += 1;
      const parts = splitCompanyRole(pendingHeading);
      if (parts) {
        push(`experience.${entryIndex}.company`, "experience", "Company", parts.company, pendingHeading, "high");
        push(`experience.${entryIndex}.role`, "experience", "Role", parts.role, pendingHeading, "high");
      } else {
        push(`experience.${entryIndex}`, "experience", "Role and company", pendingHeading, pendingHeading, "high");
      }
    }
    flushHighlights();
  }

  // Projects
  const projects = section("projects");
  if (projects) {
    let projectIndex = 0;
    let currentProject: { key: string; bullets: string[] } | null = null;
    let lastProjectBullet: number | null = null;

    const flushProjectBullets = () => {
      if (!currentProject) return;
      currentProject.bullets.slice(0, 3).forEach((bullet, index) => {
        push(
          `${currentProject?.key}.h${index + 1}`,
          "projects",
          "Project highlight",
          stripBullet(bullet),
          bullet,
          "high",
        );
      });
    };

    projects.lines.forEach((line, index) => {
      const isBullet = BULLET.test(line);

      if (isBullet) {
        currentProject?.bullets.push(line);
        lastProjectBullet = currentProject ? currentProject.bullets.length - 1 : null;
        return;
      }

      const nextLine = projects.lines[index + 1] ?? "";
      const looksLikeTitle = line.length < 200 && (DASH_SPLIT.test(line) || /:/.test(line)) && BULLET.test(nextLine);

      if (looksLikeTitle) {
        flushProjectBullets();
        projectIndex += 1;
        currentProject = { key: `projects.${projectIndex}`, bullets: [] };
        lastProjectBullet = null;
        const title = line.replace(/\s+GitHub\s*$/i, "").replace(/\s+Git\s*$/i, "").trim();
        push(currentProject.key, "projects", "Project", title, line, "high");
        return;
      }

      const previous = lastProjectBullet === null ? null : currentProject?.bullets[lastProjectBullet];
      if (previous && (previous.endsWith(",") || /^[a-z(]/.test(line))) {
        currentProject!.bullets[lastProjectBullet!] = `${previous} ${line}`.trim();
      }
    });
    flushProjectBullets();
  }

  // Skills
  const skills = section("skills");
  if (skills) {
    const groups = skills.lines
      .map((line) => {
        const match = line.match(/^([A-Za-z][A-Za-z /&+#.-]{1,40}):\s*(.+)$/);
        return match ? `${match[1].trim()}: ${match[2].trim()}` : null;
      })
      .filter((value): value is string => Boolean(value));

    if (groups.length > 0) {
      push("skills.all", "skills", "Skills", groups.join("; "), skills.lines[0], "high");
    } else if (skills.lines.length > 0) {
      push("skills.all", "skills", "Skills", skills.lines.join("; "), skills.lines[0], "medium");
    }
  }

  // Achievements
  const achievements = section("achievements");
  if (achievements) {
    const bullets = achievements.lines.filter((line) => BULLET.test(line)).map(stripBullet);
    const value = bullets.length > 0 ? bullets.join(" · ") : achievements.lines.join(" · ");
    if (value) push("achievements.all", "achievements", "Achievements", value, achievements.lines[0], "high");
  }

  if (!findPhone(header)) openQuestions.push("A phone number the resume did not state in a readable form.");
  if (!/\b(india|remote|[A-Z][a-z]+,\s*[A-Z][a-z]+)\b/.test(header.join(" "))) {
    openQuestions.push("Current city and preferred work arrangement.");
  }
  openQuestions.push("Work authorization and sponsorship needs for roles outside India.");
  openQuestions.push("Earliest start date or notice period.");

  const groups = GROUP_ORDER.filter((group) => facts.some((fact) => fact.group === group));

  return {
    documentName,
    groups,
    facts: tidyFacts(facts),
    openQuestions: [...new Set(openQuestions)].slice(0, 6),
    method: "rules",
  };
}
