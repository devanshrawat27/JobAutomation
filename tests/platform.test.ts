import test from "node:test";
import assert from "node:assert/strict";

import { unsupportedNumbers } from "../src/lib/documents/guard.ts";
import { checkResume } from "../src/lib/documents/ats.ts";
import { formatSalary, medianSalary, parseSalary } from "../src/lib/jobs/salary.ts";
import { isWithinListingWindow, listingCutoff, postingDate } from "../src/lib/jobs/window.ts";
import { visiblePostings } from "../src/lib/jobs/visibility.ts";

const now = Date.parse("2026-11-03T10:00:00Z");
const daysAgo = (days: number) => new Date(now - days * 86_400_000);

test("the listing window keeps two weeks and nothing older", () => {
  assert.equal(isWithinListingWindow({ postedAt: daysAgo(3), firstSeenAt: daysAgo(3) }, now), true);
  assert.equal(isWithinListingWindow({ postedAt: daysAgo(15), firstSeenAt: daysAgo(15) }, now), false);
  assert.equal(listingCutoff(now).toISOString(), "2026-10-20T10:00:00.000Z");
});

test("an undated posting is judged by when it was first seen", () => {
  assert.equal(postingDate(null, daysAgo(2)).getTime(), daysAgo(2).getTime());
  assert.equal(isWithinListingWindow({ postedAt: null, firstSeenAt: daysAgo(1) }, now), true);
  assert.equal(isWithinListingWindow({ postedAt: null, firstSeenAt: daysAgo(30) }, now), false);
});

test("a viewer sees public rows plus their own, never another account's", () => {
  const anonymous = visiblePostings(null);
  assert.deepEqual(anonymous, { ownerUserId: null });

  const viewer = visiblePostings("user-a");
  assert.deepEqual(viewer, { OR: [{ ownerUserId: null }, { ownerUserId: "user-a" }] });
});

test("a number that no cited fact contains is caught", () => {
  assert.deepEqual(unsupportedNumbers("Cut latency by 40% for 12 teams", ["Latency dropped 40%"]), ["12"]);
  assert.deepEqual(unsupportedNumbers("Cut latency by 40%", ["Latency dropped 40%"]), []);
  assert.deepEqual(unsupportedNumbers("No metrics here", ["anything"]), []);
});

test("pay is read from the posting in lakhs per annum", () => {
  const range = parseSalary("Compensation: ₹15–25 LPA depending on experience.");
  assert.deepEqual(range && { min: range.min, max: range.max }, { min: 15, max: 25 });

  const compact = parseSalary("Salary ₹1.8–4.2L for this role");
  assert.deepEqual(compact && { min: compact.min, max: compact.max }, { min: 1.8, max: 4.2 });

  const monthly = parseSalary("Stipend ₹50,000 per month");
  assert.deepEqual(monthly && { min: monthly.min, max: monthly.max }, { min: 6, max: null });

  assert.equal(parseSalary("5–9 years of experience, 2024–2027 batch"), null);
  assert.equal(parseSalary("We offer health insurance and learning budget"), null);
  // Business volume is not pay.
  assert.equal(
    parseSalary("Build relationships with 70-80 partner accounts and generate 80-90 lacs Gross Merchandise Value."),
    null,
  );
});

test("salary formatting and median", () => {
  assert.equal(formatSalary(15, 25), "₹15–25 LPA");
  assert.equal(formatSalary(18, null), "₹18 LPA");
  assert.equal(formatSalary(1.8, 4.2), "₹1.8–4.2 LPA");
  assert.equal(medianSalary([10, 30, 20]), 20);
  assert.equal(medianSalary([10, 20, 30, 40]), 25);
  assert.equal(medianSalary([]), null);
});

test("the ATS read rewards structure and exposes gaps", () => {
  const strong = checkResume({
    content: [
      "Devansh Rawat",
      "devansh@example.com · +91 98765 43210",
      "Experience",
      "Acme — Software Engineer, 2024 – 2025",
      "- Built a payments service handling 2M requests and cut latency 40%",
      "- Led 4 engineers and shipped weekly",
      "Education",
      "B.Tech in Computer Science, 2023 – 2027",
      "Skills",
      "React, TypeScript, Node.js, PostgreSQL",
    ].join("\n"),
    shape: { sections: [{ title: "Experience" }, { title: "Education" }, { title: "Skills" }] },
    jobSkills: ["React", "TypeScript", "Node.js"],
  });
  assert.ok(strong.score >= 80, `expected a strong score, got ${strong.score}`);
  assert.equal(strong.checks.find((check) => check.id === "contact")?.status, "pass");

  const weak = checkResume({ content: "I am a hardworking person. I want a job.", jobSkills: ["React"] });
  assert.equal(weak.grade, "weak");
  assert.ok(weak.score < 40, `expected a weak score, got ${weak.score}`);
});
