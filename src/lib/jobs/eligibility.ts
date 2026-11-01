/**
 * India hiring rules that a US tool never reads.
 *
 * Postings here state a CGPA floor, a batch year, a degree, a stipend and
 * sometimes a notice period. This module reads those statements and compares
 * them with the candidate's confirmed education facts, so the answer is
 * "7.7 against a 7.5 floor", not "strong match".
 */

export type EligibilityRule = {
  kind: "cgpa" | "percentage" | "batch" | "degree";
  /** What the posting asks for, in its own words. */
  text: string;
  value: number | null;
  scale: number | null;
  year: number | null;
  degrees: string[];
};

export type EligibilityProfile = {
  cgpa: number | null;
  cgpaScale: number | null;
  percentage: number | null;
  graduationYear: number | null;
  degree: string | null;
};

export type EligibilityVerdict = "eligible" | "check" | "not-eligible" | "unstated";

export type EligibilityResult = {
  verdict: EligibilityVerdict;
  rules: EligibilityRule[];
  reasons: string[];
};

const DEGREE_WORDS: Array<[RegExp, string]> = [
  [/\bb\.?\s?tech\b/i, "B.Tech"],
  [/\bb\.?\s?e\.?\b/i, "B.E."],
  [/\bm\.?\s?tech\b/i, "M.Tech"],
  [/\bmca\b/i, "MCA"],
  [/\bbca\b/i, "BCA"],
  [/\bb\.?\s?sc\b/i, "B.Sc"],
  [/\bmba\b/i, "MBA"],
  [/\bany (?:degree|discipline|stream)\b/i, "Any degree"],
];

function normalizeScale(value: number, scale: number | null): number {
  if (!scale || scale <= 0) return value;
  return (value / scale) * 100;
}

export function parseEligibility(text: string): EligibilityRule[] {
  const rules: EligibilityRule[] = [];
  const body = text.replace(/\s+/g, " ");

  // CGPA, with or without a scale: "CGPA 7.5+", "minimum CGPA of 6.0/10", "7.5 CGPA".
  for (const match of body.matchAll(/(?:cgpa|gpa)\s*(?:of|:)?\s*(?:min(?:imum)?\s*)?([0-9]{1,2}(?:\.[0-9]{1,2})?)(?:\s*\/\s*([0-9]{1,3}))?/gi)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0 || value > 10) continue;
    rules.push({
      kind: "cgpa",
      text: match[0].trim(),
      value,
      scale: match[2] ? Number(match[2]) : 10,
      year: null,
      degrees: [],
    });
  }

  // "60% and above", "minimum 65 %".
  for (const match of body.matchAll(
    /(?:aggregate|minimum|min\.?|at least|overall)\s*([0-9]{2})\s*%|([0-9]{2})\s*%\s*(?:and above|or above|\+|minimum|aggregate)/gi,
  )) {
    const value = Number(match[1] ?? match[2]);
    if (!Number.isFinite(value) || value < 35 || value > 100) continue;
    rules.push({ kind: "percentage", text: match[0].trim(), value, scale: 100, year: null, degrees: [] });
  }

  // Batch: "2027 batch", "batch of 2026", "graduating in 2027".
  for (const match of body.matchAll(/\b(20[2-3][0-9])\s*batch\b|\bbatch\s*of\s*(20[2-3][0-9])\b|\bgraduating\s+(?:in|by)\s*(20[2-3][0-9])\b/gi)) {
    const year = Number(match[1] ?? match[2] ?? match[3]);
    if (!Number.isFinite(year)) continue;
    rules.push({ kind: "batch", text: match[0].trim(), value: null, scale: null, year, degrees: [] });
  }

  // Degree: only when the sentence is about eligibility, not a product line
  // ("MCA Sales" is merchant cash advance, not a master's in computer apps).
  const ELIGIBILITY_CUE =
    /\b(eligib\w*|qualification|candidates?|graduates?|batch|cgpa|gpa|passing|fresher|degree is required|must have a degree)\b/i;
  const degreeSentence = body.match(/[^.]*\b(b\.?\s?tech|b\.?\s?e\.?|mca|m\.?\s?tech|bca|b\.?\s?sc|mba|any degree|any stream)\b[^.]*\./i);
  if (degreeSentence && ELIGIBILITY_CUE.test(degreeSentence[0])) {
    const degrees = DEGREE_WORDS.filter(([pattern]) => pattern.test(degreeSentence[0])).map(([, label]) => label);
    if (degrees.length > 0) {
      rules.push({
        kind: "degree",
        text: degreeSentence[0].trim().slice(0, 200),
        value: null,
        scale: null,
        year: null,
        degrees,
      });
    }
  }

  return rules.slice(0, 6);
}

export function checkEligibility(rules: EligibilityRule[], profile: EligibilityProfile): EligibilityResult {
  if (rules.length === 0) return { verdict: "unstated", rules: [], reasons: [] };

  const reasons: string[] = [];
  let notEligible = false;
  let toCheck = false;

  for (const rule of rules) {
    if (rule.kind === "cgpa" || rule.kind === "percentage") {
      const needed = rule.value ?? 0;

      if (rule.kind === "cgpa") {
        if (profile.cgpa === null) {
          toCheck = true;
          reasons.push(`Asks for ${needed} CGPA; your profile has no grade to compare`);
          continue;
        }
        const mine = normalizeScale(profile.cgpa, profile.cgpaScale);
        const floor = normalizeScale(needed, rule.scale);
        if (mine + 0.001 < floor) {
          notEligible = true;
          reasons.push(`Asks for ${needed} CGPA (${rule.text}); you have ${profile.cgpa}`);
        } else {
          reasons.push(`CGPA ${profile.cgpa} clears the ${needed} floor`);
        }
        continue;
      }

      if (profile.percentage === null) {
        toCheck = true;
        reasons.push(`Asks for ${needed}%; no percentage on your profile`);
        continue;
      }
      if (profile.percentage + 0.001 < needed) {
        notEligible = true;
        reasons.push(`Asks for ${needed}% (${rule.text}); you have ${profile.percentage}%`);
      } else {
        reasons.push(`Percentage ${profile.percentage}% clears ${needed}%`);
      }
      continue;
    }

    if (rule.kind === "batch") {
      if (profile.graduationYear === null) {
        toCheck = true;
        reasons.push(`Asks for the ${rule.year} batch; no graduation year on your profile`);
        continue;
      }
      if (profile.graduationYear !== rule.year) {
        notEligible = true;
        reasons.push(`Asks for the ${rule.year} batch; you graduate in ${profile.graduationYear}`);
      } else {
        reasons.push(`${rule.year} batch matches your graduation year`);
      }
      continue;
    }

    if (rule.kind === "degree") {
      if (!profile.degree) {
        toCheck = true;
        reasons.push(`Asks for ${rule.degrees.join(" / ")}; no degree recorded`);
        continue;
      }
      const compact = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
      const matches = rule.degrees.some(
        (degree) => degree === "Any degree" || compact(profile.degree!).includes(compact(degree)),
      );
      if (matches) {
        reasons.push(`${profile.degree} fits the degree asked for`);
      } else {
        toCheck = true;
        reasons.push(`Asks for ${rule.degrees.join(" / ")}; your degree is ${profile.degree}`);
      }
    }
  }

  return {
    verdict: notEligible ? "not-eligible" : toCheck ? "check" : "eligible",
    rules,
    reasons: reasons.slice(0, 4),
  };
}
