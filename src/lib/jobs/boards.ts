import type { BoardRef } from "@/lib/jobs/types";

/**
 * Public ATS boards verified reachable on 30 Oct 2026. Each is a company that
 * publishes its own postings; adding a board needs no API key and no scraper.
 *
 * Keep this list small and intentional: every entry is a place a candidate can
 * actually apply, not an aggregator mirror.
 */
export const BOARDS: BoardRef[] = [
  { source: "hn", token: "whoishiring", company: "Hacker News" },
  { source: "mastodon", token: "hiring", company: "Mastodon #hiring" },
  { source: "mastodon", token: "jobopening", company: "Mastodon #jobopening" },
  { source: "mastodon", token: "techjobs", company: "Mastodon #techjobs" },
  { source: "lever", token: "cred", company: "CRED" },
  { source: "lever", token: "meesho", company: "Meesho" },
  { source: "lever", token: "paytm", company: "Paytm" },
  { source: "lever", token: "porter", company: "Porter" },
  { source: "lever", token: "zeta", company: "Zeta" },
  { source: "ashby", token: "linear", company: "Linear" },
  { source: "ashby", token: "supabase", company: "Supabase" },
  { source: "smartrecruiters", token: "Freshworks", company: "Freshworks" },
  { source: "smartrecruiters", token: "Swiggy", company: "Swiggy" },
  { source: "greenhouse", token: "groww", company: "Groww" },
  { source: "greenhouse", token: "hackerrank", company: "HackerRank" },
  { source: "greenhouse", token: "gitlab", company: "GitLab" },
  { source: "greenhouse", token: "figma", company: "Figma" },
  { source: "greenhouse", token: "stripe", company: "Stripe" },
];
