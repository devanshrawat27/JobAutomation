import type { ApplicationStatus } from "@/generated/prisma/client";

export const statusLabels: Record<ApplicationStatus, string> = {
  PREPARED: "Prepared",
  FILLED: "Form filled",
  SUBMIT_ATTEMPTED: "Submit attempted",
  RECEIPT_CONFIRMED: "Receipt confirmed",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const statusHints: Record<ApplicationStatus, string> = {
  PREPARED: "You have a draft. Nothing has been sent.",
  FILLED: "The employer form was filled, but you have not submitted it.",
  SUBMIT_ATTEMPTED: "Submit was pressed; receipt is not confirmed yet.",
  RECEIPT_CONFIRMED: "You have evidence the employer received it.",
  INTERVIEW: "You were invited to interview.",
  OFFER: "You received an offer.",
  REJECTED: "The employer declined.",
  WITHDRAWN: "You withdrew.",
};

/** Groups the select so the consequential states are not next to "prepared". */
export const statusGroups: Array<{ label: string; options: ApplicationStatus[] }> = [
  { label: "Before sending", options: ["PREPARED", "FILLED"] },
  { label: "Sent", options: ["SUBMIT_ATTEMPTED", "RECEIPT_CONFIRMED"] },
  { label: "Outcome", options: ["INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"] },
];

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return Object.prototype.hasOwnProperty.call(statusLabels, value);
}
