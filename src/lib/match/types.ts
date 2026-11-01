export type RequirementStatus = "match" | "partial" | "gap" | "unknown";

export type RequirementMatch = {
  id: string;
  /** What the job asks for, in one line. */
  text: string;
  /** The job sentence the requirement came from. */
  source: string;
  importance: "must" | "nice";
  status: RequirementStatus;
  /** The candidate fact that answers it, quoted. */
  evidence: string | null;
  note: string | null;
};

export type MatchResult = {
  requirements: RequirementMatch[];
  counts: Record<RequirementStatus, number>;
  method: "ai" | "rules";
  generatedAt: string;
};

export type FactForMatch = {
  group: string;
  label: string;
  value: string;
};

export const statusLabels: Record<RequirementStatus, string> = {
  match: "Supported",
  partial: "Partial",
  gap: "Gap",
  unknown: "Not on your profile",
};
