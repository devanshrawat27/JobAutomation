import test from "node:test";
import assert from "node:assert/strict";

import { unsupportedNumbers } from "../src/lib/documents/guard.ts";
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
