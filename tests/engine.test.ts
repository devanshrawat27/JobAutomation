import test from "node:test";
import assert from "node:assert/strict";

import { checkEligibility, parseEligibility } from "../src/lib/jobs/eligibility.ts";
import { assessPosting } from "../src/lib/jobs/trust.ts";
import { matchPosting, buildCandidate, entryFriendly, mustHaveSkills } from "../src/lib/jobs/match.ts";
import { formatMonths } from "../src/lib/match/experience.ts";
import { parseReach, scoreReach } from "../src/lib/jobs/place.ts";
import { parseDateRange, rangeMonths, requiredYears, totalMonths } from "../src/lib/match/experience.ts";
import { extractSkills } from "../src/lib/jobs/skills.ts";

const profile = { cgpa: 8.4, cgpaScale: 10, percentage: 84, graduationYear: 2027, degree: "B.Tech in Computer Science" };

test("years of experience merges overlapping roles", () => {
  const first = parseDateRange("Jan 2023 - Dec 2023");
  const overlapping = parseDateRange("Jun 2023 - Jun 2024");
  assert.ok(first && overlapping);
  // Jan 2023 - Jun 2024 is 18 months: the second role repeats Jul-Dec 2023,
  // which must not be counted twice.
  assert.equal(totalMonths([first, overlapping]), 18);
});

test("required years reads a floor and ignores implausible numbers", () => {
  assert.equal(requiredYears("3+ years of experience"), 3);
  assert.equal(requiredYears("2-4 years in backend"), 2);
  assert.equal(requiredYears("no experience needed"), null);
  assert.equal(requiredYears("salary 18+ years bonus"), 18);
});

test("eligibility compares CGPA, batch and degree", () => {
  const rules = parseEligibility("Eligibility: 2027 batch, minimum CGPA 7.5, B.Tech/BE only.");
  const result = checkEligibility(rules, profile);
  assert.equal(result.verdict, "eligible");
  assert.ok(result.reasons.some((reason) => /clears the 7.5 floor/.test(reason)));
});

test("eligibility rejects a different batch", () => {
  const rules = parseEligibility("Open to the 2026 batch only.");
  const result = checkEligibility(rules, profile);
  assert.equal(result.verdict, "not-eligible");
  assert.ok(result.reasons.some((reason) => /2026 batch/.test(reason)));
});

test("a business phrase is not a degree requirement", () => {
  const rules = parseEligibility("Responsible for the MCA Sales in the city. Manage an assigned sales area.");
  assert.equal(rules.filter((rule) => rule.kind === "degree").length, 0);
});

test("a fee request is high risk, a normal posting is not", () => {
  const scam = assessPosting({
    title: "Work from home data entry",
    company: "Hiring",
    url: "https://bit.ly/abc",
    description: "Earn ₹5,000 per day. Registration fee ₹499 refundable. Contact on WhatsApp only.",
  });
  assert.equal(scam.risk, "high");
  assert.ok(scam.flags.some((flag) => flag.label === "Asks for money"));

  const clean = assessPosting({
    title: "Software Engineer Intern",
    company: "HackerRank",
    url: "https://job-boards.greenhouse.io/hackerrank/jobs/1",
    description: "We are hiring an intern. Stipend ₹50,000 per month. Apply on our careers page.",
  });
  assert.equal(clean.risk, "low");
});

test("remote restricted to another country earns nothing", () => {
  const place = { country: "India", cities: ["bengaluru"], remoteFriendly: true };
  assert.equal(scoreReach(parseReach("Remote (UT or ID residents only)", "Engineer", ""), place).points, 0);
  assert.equal(scoreReach(parseReach("Remote, worldwide", "Engineer", ""), place).points, 9);
  assert.equal(scoreReach(parseReach("Bengaluru, India", "Engineer", ""), place).points, 10);
});

test("a fresher is not outranked by a senior role", () => {
  const candidate = buildCandidate([
    { label: "Full Name", value: "Aarav Mehta", group: "contact" },
    { label: "Graduation Year", value: "2023 - 2027", group: "education" },
    { label: "Degree", value: "B.Tech in Computer Science", group: "education" },
    { label: "Experience", value: "Acme - SDE Intern\n2026 - Present\n• React, TypeScript, Node.js", group: "experience" },
  ]);

  const intern = matchPosting(
    {
      title: "Software Engineer Intern",
      department: "Engineering",
      location: "Bengaluru, India",
      description: "React, TypeScript and Node.js. Internship for 2027 graduates.",
      skills: ["React", "TypeScript", "Node.js"],
      seniority: "intern",
      yearsMin: null,
      remote: false,
      updatedAt: new Date().toISOString(),
    },
    candidate,
  );

  const senior = matchPosting(
    {
      title: "Principal Software Engineer",
      department: "Engineering",
      location: "Bengaluru, India",
      description: "React, TypeScript and Node.js. 8+ years leading platform teams.",
      skills: ["React", "TypeScript", "Node.js"],
      seniority: "lead",
      yearsMin: 8,
      remote: false,
      updatedAt: new Date().toISOString(),
    },
    candidate,
  );

  assert.ok(entryFriendly({ title: "Software Engineer Intern", description: "Internship" }));
  assert.ok(intern.score > senior.score, `intern ${intern.score} should beat senior ${senior.score}`);
  assert.ok(senior.score <= 45);
});

test("skills are canonical, not string-matched", () => {
  const found = extractSkills("We use ReactJS, Node.js, Postgres and k8s.");
  assert.ok(found.includes("React"));
  assert.ok(found.includes("Node.js"));
  assert.ok(found.includes("PostgreSQL"));
  assert.ok(found.includes("Kubernetes"));
});

test("must-have skills are read from the posting's own wording", () => {
  const skills = ["React", "Node.js", "Java", "Figma"];
  const must = mustHaveSkills(
    "Requirements: strong React and Java. Node.js is a plus. Familiarity with Figma is nice to have.",
    skills,
  );
  assert.ok(must.has("React"));
  assert.ok(must.has("Java"));
  assert.ok(!must.has("Node.js"));
  assert.ok(!must.has("Figma"));
});

test("education dates are not work experience", () => {
  const candidate = buildCandidate([
    { label: "Institution", value: "Graphic Era Hill University", group: "education" },
    { label: "Dates", value: "Aug 2023 – May 2027", group: "education" },
    {
      label: "Experience",
      value: "Acme — SDE Intern\nJan 2024 – Mar 2024\n• Built an API",
      group: "experience",
    },
  ]);

  assert.equal(candidate.months, 3);
  assert.equal(formatMonths(candidate.months), "3 months");
});

test("an open-ended role counts elapsed months, not inclusive ones", () => {
  const range = parseDateRange("Aug 2026 – Present", new Date(2026, 10, 4));
  assert.ok(range);
  assert.equal(rangeMonths(range), 3);
});

test("saved job preferences feed the candidate model", () => {
  const candidate = buildCandidate([
    { label: "Target roles", value: "Backend Engineer, Platform Engineer", group: "preferences" },
    { label: "Preferred locations", value: "Pune, Remote", group: "preferences" },
    { label: "Work mode", value: "remote", group: "preferences" },
    { label: "Minimum salary (LPA)", value: "10", group: "preferences" },
    { label: "Excluded companies or words", value: "HackerRank, staffing", group: "preferences" },
  ]);

  assert.equal(candidate.salaryFloor, 10);
  assert.deepEqual(candidate.exclude, ["hackerrank", "staffing"]);
  assert.equal(candidate.remoteFriendly, true);
  assert.ok(candidate.locations.includes("pune"));
  assert.ok(candidate.titles.includes("Backend Engineer"));
});

test("stated years and expected CTC outrank resume dates and old floors", () => {
  const candidate = buildCandidate([
    { label: "Total years of experience", value: "4", group: "preferences" },
    { label: "Expected CTC (LPA)", value: "14", group: "preferences" },
    { label: "Minimum salary (LPA)", value: "9", group: "preferences" },
    { label: "Willing to relocate", value: "yes", group: "preferences" },
    { label: "Work experience — Backend Intern", value: "Acme\nJan 2026 – Mar 2026", group: "experience" },
    { label: "Top skills", value: "Go, PostgreSQL", group: "preferences" },
  ]);

  assert.equal(candidate.years, 4);
  assert.equal(candidate.months, 48);
  assert.equal(candidate.seniority, "senior");
  assert.equal(candidate.salaryFloor, 14);
  assert.equal(candidate.relocate, true);
  assert.ok(candidate.skills.some((skill) => /postgres/i.test(skill)));
});
