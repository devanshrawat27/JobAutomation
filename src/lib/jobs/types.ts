export type JobSourceId = "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters" | "hn" | "manual" | "mastodon";

export type BoardRef = {
  source: JobSourceId;
  /** The public board token, e.g. "groww" for boards.greenhouse.io/groww. */
  token: string;
  company: string;
};

export type JobPosting = {
  /** Source-prefixed so two boards can never collide. */
  id: string;
  /** The id inside the source, needed to fetch details. */
  externalId: string;
  source: JobSourceId;
  board: string;
  company: string;
  title: string;
  location: string | null;
  department: string | null;
  url: string;
  updatedAt: string | null;
  /** Body text when the source returns it with the listing. */
  content?: string;
};

export type BoardResult = {
  board: BoardRef;
  postings: JobPosting[];
  error?: string;
  fetchedAt: string;
};

export type JobSourceAdapter = {
  source: JobSourceId;
  listPostings: (board: BoardRef, signal?: AbortSignal) => Promise<JobPosting[]>;
};
