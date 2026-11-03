import { parseDateRange, totalMonths, type DateRange } from "@/lib/match/experience";

import { parseReach, scoreReach, type CandidatePlace } from "@/lib/jobs/place";
import { canonicalizeSkills, extractSkills, normalizeSkill } from "@/lib/jobs/skills";

/**
 * The matching engine behind "For you".
 *
 * It is deterministic and explainable: every point comes from a signal the
 * candidate can check — skills the posting names, the title, the years it asks
 * for, the location, and how recently it was posted. Nothing is guessed and no
 * model decides the order.
 */

export type CandidateFacts = { label: string; value: string; group?: string };

export type CandidateModel = {
  skills: string[];
  looseSkills: string[];
  titles: string[];
  roleWords: string[];
  years: number;
  locations: string[];
  remoteFriendly: boolean;
  seniority: "fresher" | "junior" | "mid" | "senior" | "lead";
  family: string | null;
  /** Still studying, or graduated in the current/future year. */
  student: boolean;
  graduationYear: number | null;
};

export type JobSignals = {
  source?: string;
  title: string;
  department: string | null;
  location: string | null;
  description: string;
  skills: string[];
  seniority: string | null;
  yearsMin: number | null;
  remote: boolean;
  updatedAt: string | null;
};

export type MatchBreakdown = {
  score: number;
  verdict: "strong" | "good" | "possible" | "weak";
  matched: string[];
  missing: string[];
  reasons: string[];
  parts: { skills: number; title: number; seniority: number; location: number; freshness: number };
};

const ROLE_WORDS = [
  "engineer", "developer", "intern", "internship", "analyst", "designer", "manager",
  "scientist", "architect", "consultant", "programmer", "administrator", "specialist",
  "lead", "researcher", "marketer", "writer", "recruiter", "operations",
];

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "at", "on", "with", "senior",
  "junior", "staff", "principal", "lead", "sr", "jr", "ii", "iii", "iv", "i", "remote",
]);

/**
 * Job families. A Fraud Operations role is not a worse software job — it is a
 * different job, and a candidate cannot be ranked above engineers by it.
 */
const FAMILY_ORDER = [
  "support",
  "operations",
  "design",
  "product",
  "sales",
  "marketing",
  "finance",
  "hr",
  "data",
  "engineering",
] as const;

const FAMILIES: Record<(typeof FAMILY_ORDER)[number], string[]> = {
  support: ["support", "customer", "success", "advocate", "community", "ambassador", "crew"],
  operations: ["operations", "ops", "logistics", "supply chain", "process", "risk", "fraud", "compliance", "sanctions", "trust"],
  design: ["designer", "design", "ux", "ui", "brand studio"],
  product: ["product manager", "product owner", "program manager"],
  sales: ["sales", "account executive", "business development", "partnerships", "revenue"],
  marketing: ["marketing", "content", "brand", "growth", "communications", "seo"],
  finance: ["finance", "accounting", "credit", "treasury", "tax", "audit"],
  hr: ["recruit", "talent", "people operations", "human resources"],
  data: ["data engineer", "data scientist", "analyst", "analytics", "machine learning", "ml", "statistician"],
  engineering: ["engineer", "engineering", "developer", "sde", "swe", "programmer", "devops", "sre", "architect", "full stack", "backend", "frontend", "qa"],
};

export function roleFamily(text: string): string | null {
  const lower = text.toLowerCase();
  let best: { family: string; hits: number } | null = null;

  for (const family of FAMILY_ORDER) {
    const words = FAMILIES[family];
    let hits = 0;
    for (const word of words) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(lower)) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { family, hits };
  }

  return best?.family ?? null;
}

/** When a profile names no title, its toolbox still says which family it is in. */
function familyFromSkills(skills: string[]): string | null {
  const set = new Set(skills);
  const has = (...names: string[]) => names.some((name) => set.has(name));

  if (has("React", "Next.js", "Node.js", "TypeScript", "JavaScript", "Java", "Go", "C++", "C#", "Spring Boot", "Django", "FastAPI")) {
    return "engineering";
  }
  if (has("Machine Learning", "PyTorch", "TensorFlow", "Spark", "dbt", "Airflow", "Snowflake")) return "data";
  if (has("Figma")) return "design";
  return null;
}

const LEVELS: Array<{ level: CandidateModel["seniority"]; years: number }> = [
  { level: "lead", years: 8 },
  { level: "senior", years: 4 },
  { level: "mid", years: 2 },
  { level: "junior", years: 0.5 },
  { level: "fresher", years: 0 },
];

function datedRanges(facts: CandidateFacts[]): DateRange[] {
  const ranges: DateRange[] = [];

  for (const fact of facts) {
    // Experience cards hold "Company — Role", the dates and bullets on separate
    // lines; any line that parses as a range counts once.
    const looksLikeExperience =
      fact.group === "experience" || /date|experience|role|intern|work/i.test(fact.label);
    if (!looksLikeExperience) continue;

    for (const line of fact.value.split("\n")) {
      const range = parseDateRange(line);
      if (range) ranges.push(range);
    }
  }

  return ranges;
}

/** Everything the matcher needs, read from confirmed facts only. */
export function buildCandidate(facts: CandidateFacts[]): CandidateModel {
  const skillText: string[] = [];
  const titles = new Set<string>();
  const locations = new Set<string>();
  let remoteFriendly = false;
  let graduationYear: number | null = null;

  for (const fact of facts) {
    const label = fact.label.toLowerCase();

    if (/skill|language|frontend|front-end|backend|back-end|data|tools|framework|database|cloud|fundamentals|technolog/i.test(label)) {
      skillText.push(fact.value);
    }
    // Bullets mention technologies too; the experience card is where most of a
    // candidate's real toolbox shows up.
    if (fact.group === "experience" || fact.group === "projects") {
      skillText.push(fact.value);
    }

    if (/role|title|position|experience|company|intern/i.test(label) || fact.group === "experience") {
      for (const line of fact.value.split("\n")) {
        // "Company — Role" is the merged card shape; a plain "Role" line also counts.
        const afterDash = line.split("—")[1]?.trim();
        const candidateLine = (afterDash && afterDash.length > 2 ? afterDash : line).trim();
        if (!candidateLine || candidateLine.length > 90) continue;
        if (ROLE_WORDS.some((word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, "i").test(candidateLine))) {
          titles.add(candidateLine);
        }
      }
    }

    // "Graduation Year: 2023 - 2027" is the strongest fresher signal a resume gives.
    if (/graduat|passing|batch|class of/i.test(label) || /class of/i.test(fact.value)) {
      for (const match of fact.value.matchAll(/(20\d{2})/g)) {
        const year = Number(match[1]);
        if (year >= 2000 && year <= 2100) graduationYear = Math.max(graduationYear ?? year, year);
      }
    }

    if (/city|location|based|address/i.test(label)) {
      for (const part of fact.value.split(/[,/]/)) {
        const token = normalizeSkill(part);
        if (token.length >= 3) locations.add(token);
      }
    }
  }

  for (const fact of facts) {
    const text = fact.value.toLowerCase();
    if (/\bremote\b|\bhybrid\b|\bwork from home\b|\bwfh\b/.test(text)) remoteFriendly = true;
    for (const city of ["bengaluru", "bangalore", "mumbai", "pune", "delhi", "gurugram", "noida", "hyderabad", "chennai", "kolkata", "ahmedabad", "jaipur", "indore", "kochi"]) {
      if (text.includes(city)) locations.add(city);
    }
  }

  const combined = skillText.join(" \n ");
  const extracted = extractSkills(combined, 40);
  const split = combined
    .split(/[,;·|]/)
    .map((item) => item.replace(/^[^:]{1,30}:\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 60);
  const { canonical, extra } = canonicalizeSkills(split);

  const skills = [...new Set([...extracted, ...canonical])];

  const wholeText = facts.map((fact) => fact.value).join(" \n ").toLowerCase();
  const roleWords = ROLE_WORDS.filter((word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(wholeText));

  const months = totalMonths(datedRanges(facts));
  const years = Math.round((months / 12) * 10) / 10;
  const seniority = [...LEVELS].find((level) => years >= level.years)?.level ?? "fresher";

  return {
    skills,
    looseSkills: extra,
    titles: [...titles],
    roleWords,
    years,
    locations: [...locations],
    remoteFriendly,
    seniority,
    family: roleFamily(`${[...titles].join(" ")} ${roleWords.join(" ")}`) ?? familyFromSkills(skills),
    student: graduationYear !== null && graduationYear >= new Date().getFullYear(),
    graduationYear,
  };
}


/**
 * Skills the posting treats as mandatory, read from its own wording.
 *
 * A skill listed under "Requirements" is not the same signal as one buried in
 * a paragraph. This keeps the matcher honest without a model: a must-have gets
 * double weight, a nice-to-have keeps single weight.
 */
export function mustHaveSkills(description: string, skills: string[]): Set<string> {
  const lines = description
    .split(/\n|(?<=[.;])\s+/)
    .map((line) => line.toLowerCase())
    .filter(
      (line) =>
        /\b(must|required|requirements?|minimum|essential|should have|need to have)\b/.test(line) &&
        !/\b(nice|plus|bonus|preferred|good to have)\b/.test(line),
    );

  return new Set(skills.filter((skill) => lines.some((line) => line.includes(skill.toLowerCase()))));
}

/** Internships, graduate programmes and 0-2 year roles: what a fresher can win. */
export function entryFriendly(job: { title: string; description: string }): boolean {  const text = `${job.title} ${job.description.slice(0, 900)}`.toLowerCase();
  return /\b(intern|internship|graduate programme|graduate program|new grad|fresher|entry[\s-]?level|trainee|campus|apprentice|campus hire|0\s*[-\u2013]\s*[12]\s*years?|no prior experience)\b/.test(
    text,
  );
}

/** Seniority the posting itself states, so a "Staff" role is not scored as entry level. */
export function seniorityOf(text: string): "intern" | "junior" | "mid" | "senior" | "lead" | null {
  const lower = text.toLowerCase();
  if (/\bintern(ship)?\b/.test(lower)) return "intern";
  if (/\b(staff|principal|distinguished|head of|head|director|vp|manager)\b/.test(lower)) return "lead";
  if (/\b(senior|sr\.?|lead|architect)\b/.test(lower)) return "senior";
  if (/\b(junior|jr\.?|entry[- ]level|graduate|fresher|associate)\b/.test(lower)) return "junior";
  if (/\b(mid[- ]level|intermediate)\b/.test(lower)) return "mid";
  return null;
}

function jobTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function titlePart(job: JobSignals, candidate: CandidateModel): { points: number; reason: string | null } {
  const jobWords = new Set(jobTokens(`${job.title} ${job.department ?? ""}`));
  const candidateWords = new Set([
    ...jobTokens(candidate.titles.join(" ")),
    ...candidate.roleWords,
  ]);

  let hits = 0;
  for (const word of jobWords) if (candidateWords.has(word)) hits += 1;

  const coverage = jobWords.size === 0 ? 0 : hits / Math.min(jobWords.size, 6);
  const points = Math.min(20, Math.round(coverage * 20));

  const reason =
    hits >= 2
      ? `Title overlaps your roles on ${hits} word${hits === 1 ? "" : "s"}`
      : hits === 1
        ? "Title shares a word with the roles you have held"
        : null;

  return { points, reason };
}

function seniorityPart(job: JobSignals, candidate: CandidateModel): { points: number; reason: string | null; cap: number } {
  const jobLevel = job.seniority ?? seniorityOf(`${job.title} ${job.description.slice(0, 400)}`);
  const asks = job.yearsMin;

  let points = 10;
  let reason: string | null = null;
  let cap = 100;

  if (asks !== null) {
    if (candidate.years >= asks) {
      points = 15;
      reason = `Asks for ${asks}+ year${asks === 1 ? "" : "s"}; your dates add up to ${candidate.years}`;
    } else if (candidate.years >= asks - 1) {
      points = 10;
      reason = `Asks for ${asks}+ years; you are close at ${candidate.years}`;
    } else {
      points = Math.max(0, 15 - Math.round((asks - candidate.years) * 5));
      reason = `Asks for ${asks}+ years; your dated experience is ${candidate.years}`;
    }
  } else if (jobLevel === "intern" || jobLevel === "junior") {
    points = candidate.seniority === "fresher" || candidate.seniority === "junior" ? 14 : 8;
    reason = jobLevel === "intern" ? "An internship, which matches where you are" : "Entry-level posting";
  } else if (jobLevel === "lead") {
    points = candidate.years >= 6 ? 14 : 0;
    cap = candidate.years >= 6 ? 100 : 34;
    reason = candidate.years >= 6 ? "A senior posting that fits your experience" : "A lead or manager posting, above your dated experience";
  } else if (jobLevel === "senior") {
    points = candidate.years >= 3 ? 14 : 3;
    cap = candidate.years >= 3 ? 100 : 48;
    reason = candidate.years >= 3 ? "Senior-level match" : "Senior posting; you may be early for it";
  } else if (jobLevel === null) {
    points = candidate.seniority === "fresher" ? 12 : 10;
    reason = "The posting does not state the years it wants — scored neutral";
  } else if (candidate.seniority === "fresher") {
    points = 12;
  }

  return { points, reason, cap };
}

function locationPart(
  job: JobSignals,
  candidate: CandidateModel,
): { points: number; reason: string | null; blocked: boolean; foreign: boolean } {
  const reach = parseReach(job.location, job.title, job.description);
  const place: CandidatePlace = {
    country: "India",
    cities: candidate.locations.length > 0 ? candidate.locations : ["bengaluru", "bangalore", "mumbai", "pune", "delhi", "hyderabad", "chennai"],
    remoteFriendly: candidate.remoteFriendly,
  };

  return scoreReach(reach, place);
}

function freshnessPart(job: JobSignals): number {
  if (!job.updatedAt) return 2;
  const days = (Date.now() - Date.parse(job.updatedAt)) / 86_400_000;
  if (Number.isNaN(days)) return 2;
  if (days <= 3) return 5;
  if (days <= 14) return 4;
  if (days <= 45) return 2;
  return 1;
}

/**
 * Score one posting against one candidate.
 *
 * Weights: skills 45, title 20, seniority 15, location 10, freshness 5.
 * A posting that asks for years the candidate does not have is capped, so a
 * strong skill list cannot disguise a five-year role.
 */
export function matchPosting(job: JobSignals, candidate: CandidateModel): MatchBreakdown {
  const titleLower = job.title.toLowerCase();
  const candidateSet = new Set(candidate.skills.map((skill) => skill.toLowerCase()));
  const loose = new Set(candidate.looseSkills);

  const matched: string[] = [];
  const missing: string[] = [];
  const must = mustHaveSkills(job.description, job.skills);
  let weightTotal = 0;
  let weightHit = 0;
  let mustMatched = 0;

  for (const skill of job.skills) {
    const key = skill.toLowerCase();
    const weight = titleLower.includes(key) ? 3 : must.has(skill) ? 2 : 1;
    weightTotal += weight;

    if (candidateSet.has(key) || loose.has(normalizeSkill(skill))) {
      matched.push(skill);
      weightHit += weight;
      if (must.has(skill)) mustMatched += 1;
    } else {
      missing.push(skill);
    }
  }

  const skillRatio = weightTotal === 0 ? 0 : weightHit / weightTotal;
  // A posting that names one or two technologies should not score 45/45 just
  // because the candidate happens to have them. Density scales the signal to
  // how much the posting actually asks for.
  const density = 0.55 + 0.45 * Math.min(1, weightTotal / 9);
  const skillPoints = Math.round(skillRatio * 45 * density);

  const jobFamily =
    roleFamily(`${job.title} ${job.department ?? ""}`) ?? roleFamily(job.description.slice(0, 320));
  const familyMismatch = Boolean(jobFamily && candidate.family && jobFamily !== candidate.family);

  const title = titlePart(job, candidate);
  // Same job family counts even when the words differ ("SDE" vs "Software Engineer").
  if (!familyMismatch && candidate.family && jobFamily === candidate.family && title.points < 12) {
    title.points = 12;
    if (!title.reason) title.reason = `${/^[aeiou]/i.test(candidate.family) ? "An" : "A"} ${candidate.family} role, like the ones you have held`;
  }
  const seniority = seniorityPart(job, candidate);
  const location = locationPart(job, candidate);
  const freshness = freshnessPart(job);

  // A founder or team posting directly is read by fewer people than an ATS
  // board listing, so the same fit is worth slightly more to the candidate.
  const community = job.source === "hn" || job.source === "manual" || job.source === "mastodon";
  const direct = community ? 3 : 0;

  const entry = entryFriendly(job);
  const jobLevel = job.seniority ?? seniorityOf(`${job.title} ${job.description.slice(0, 400)}`);
  const fresher = candidate.student || candidate.seniority === "fresher";

  // A fresher is not a worse mid-level candidate; they are applying to a
  // different shelf. Internships and 0-2 year roles get a lift, and roles that
  // ask for years they cannot have are pushed down instead of flattered.
  let fresherAdjust = 0;
  let fresherCap = 100;
  if (fresher) {
    if (entry) {
      fresherAdjust = 14;
    } else if (job.yearsMin !== null && job.yearsMin >= 3) {
      fresherAdjust = -14;
      fresherCap = 44;
    } else if (job.yearsMin !== null && job.yearsMin >= 2) {
      fresherAdjust = -6;
      fresherCap = 56;
    } else if (jobLevel === "lead") {
      fresherAdjust = -10;
      fresherCap = 40;
    } else if (jobLevel === "senior") {
      fresherAdjust = -6;
      fresherCap = 48;
    }
  }

  const raw =
    skillPoints +
    title.points +
    seniority.points +
    location.points +
    freshness +
    direct +
    fresherAdjust -
    (familyMismatch ? 26 : 0);
  let cap = Math.min(seniority.cap, familyMismatch ? 52 : 100, fresherCap);

  // A posting that requires residence elsewhere, or sits in another country,
  // cannot be ranked like a local one however well the skills line up.
  if (location.blocked) cap = Math.min(cap, 30);
  else if (location.foreign) cap = Math.min(cap, 45);

  const score = Math.max(0, Math.min(100, Math.min(raw, cap)));

  const reasons: string[] = [];
  if (direct > 0) {
    reasons.push(
      job.source === "manual"
        ? "A hiring post you added yourself"
        : job.source === "mastodon"
          ? "Posted directly by a team on Mastodon"
          : "Posted directly by the team on Hacker News",
    );
  }
  if (fresher && entry) {
    reasons.push("An internship or entry-level role, made for where you are");
  }
  if (familyMismatch) {
    const familyLabel = jobFamily ?? "other";
    reasons.push(`${/^[aeiou]/i.test(familyLabel) ? "An" : "A"} ${familyLabel} role, not ${candidate.family}`);
  }
  if (mustMatched > 0) {
    reasons.push(`Meets ${mustMatched} must-have skill${mustMatched === 1 ? "" : "s"} the posting names`);
  }
  if (matched.length > 0) {
    reasons.push(`Covers ${matched.length} of ${job.skills.length} named skills: ${matched.slice(0, 4).join(", ")}`);
  }
  if (missing.length > 0) {
    reasons.push(`Not on your profile: ${missing.slice(0, 3).join(", ")}`);
  }
  if (title.reason) reasons.push(title.reason);
  if (seniority.reason) reasons.push(seniority.reason);
  if (location.reason) reasons.push(location.reason);

  const verdict: MatchBreakdown["verdict"] =
    score >= 66 ? "strong" : score >= 50 ? "good" : score >= 32 ? "possible" : "weak";

  return {
    score,
    verdict,
    matched: matched.slice(0, 6),
    missing: missing.slice(0, 4),
    reasons: reasons.slice(0, 4),
    parts: {
      skills: skillPoints,
      title: title.points,
      seniority: seniority.points,
      location: location.points,
      freshness,
    },
  };
}
