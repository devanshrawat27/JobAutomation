import test from "node:test";
import assert from "node:assert/strict";

import { checkEligibility, parseEligibility } from "../src/lib/jobs/eligibility.ts";
import { assessPosting } from "../src/lib/jobs/trust.ts";
import { matchPosting, buildCandidate, entryFriendly } from "../src/lib/jobs/match.ts";
import { parseReach, scoreReach } from "../src/lib/jobs/place.ts";
import { parseDateRange, requiredYears, totalMonths } from "../src/lib/match/experience.ts";
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
