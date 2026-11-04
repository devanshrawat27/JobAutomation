/**
 * Profile facts proposed from a resume, and the sample data used to demonstrate
 * the review step.
 *
 * Boundary: this module holds the shape of a *proposal*, never confirmed truth.
 * A future extraction service should produce `ProfileFact[]`; the review UI is
 * the only place a fact becomes confirmed, edited, skipped or not applicable.
 *
 * The sample extractions below are fictional. No file is uploaded or parsed by
 * this prototype.
 */

export type CandidatePath = "new-grad" | "experienced";

export type FactConfidence = "high" | "medium" | "low";

export type FactStatus = "suggested" | "confirmed" | "edited" | "skipped" | "not-applicable";

export type FactGroupId = "contact" | "education" | "experience" | "projects" | "skills" | "achievements" | "preferences";

export type ProfileFact = {
  id: string;
  group: FactGroupId;
  label: string;
  value: string;
  /** The resume line the proposal came from. Always shown next to the fact. */
  source: string;
  confidence: FactConfidence;
  /** Why this needs care: an inference, an untouched figure, or an unverified link. */
  hint?: string;
};

export type SampleExtraction = {
  documentName: string;
  groups: FactGroupId[];
  facts: ProfileFact[];
  /** Facts the resume did not answer. Asked only when a job needs them. */
  openQuestions: string[];
};

export const factGroups: Record<FactGroupId, { title: string; note: string }> = {
  contact: { title: "Contact", note: "Used only to fill employer forms" },
  education: { title: "Education", note: "Grades stay in their original scale" },
  experience: { title: "Experience", note: "Roles, dates and what you did" },
  projects: { title: "Projects", note: "Work that shows what you can do" },
  skills: { title: "Skills and certifications", note: "Reusable across applications" },
  achievements: { title: "Honours and achievements", note: "Only what your resume states" },
  preferences: { title: "Job preferences", note: "What the matcher should aim at" },
};

export const confidenceLabels: Record<FactConfidence, string> = {
  high: "High confidence",
  medium: "Needs a check",
  low: "Low confidence",
};

export const statusLabels: Record<FactStatus, string> = {
  suggested: "Not reviewed",
  confirmed: "Confirmed",
  edited: "Edited",
  skipped: "Skipped",
  "not-applicable": "Not applicable",
};

export const sampleExtractions: Record<CandidatePath, SampleExtraction> = {
  "new-grad": {
    documentName: "aarav-mehta-resume.pdf",
    groups: ["contact", "education", "experience", "projects", "skills"],
    facts: [
      {
        id: "ng-name",
        group: "contact",
        label: "Full name",
        value: "Aarav Mehta",
        source: "Aarav Mehta",
        confidence: "high",
      },
      {
        id: "ng-email",
        group: "contact",
        label: "Email",
        value: "aarav.mehta@example.com",
        source: "aarav.mehta@example.com · +91 90000 00123",
        confidence: "high",
      },
      {
        id: "ng-phone",
        group: "contact",
        label: "Phone",
        value: "+91 90000 00123",
        source: "aarav.mehta@example.com · +91 90000 00123",
        confidence: "high",
      },
      {
        id: "ng-location",
        group: "contact",
        label: "Location",
        value: "Pune, Maharashtra, India",
        source: "Pune, Maharashtra · github.com/aaravmehta",
        confidence: "high",
      },
      {
        id: "ng-institution",
        group: "education",
        label: "Institution",
        value: "Vellore Institute of Technology",
        source: "Vellore Institute of Technology, Vellore — 2023–2027",
        confidence: "high",
      },
      {
        id: "ng-degree",
        group: "education",
        label: "Degree and discipline",
        value: "B.Tech, Computer Science and Engineering",
        source: "B.Tech, Computer Science and Engineering",
        confidence: "high",
      },
      {
        id: "ng-graduation",
        group: "education",
        label: "Graduation",
        value: "Batch of 2027 · expected July 2027",
        source: "2023–2027",
        confidence: "medium",
        hint: "The month is inferred from the year range on your resume. Confirm the exact date before an employer form asks for it.",
      },
      {
        id: "ng-grade",
        group: "education",
        label: "Grade",
        value: "CGPA 8.4 / 10",
        source: "CGPA: 8.4 / 10",
        confidence: "high",
        hint: "Your resume states the 10-point scale, so we keep it exactly as written. We never convert it to a percentage.",
      },
      {
        id: "ng-internship",
        group: "experience",
        label: "Internship",
        value: "Software Engineering Intern — Zeta Systems (May–July 2026)",
        source: "Software Engineering Intern, Zeta Systems — May 2026 – July 2026",
        confidence: "high",
      },
      {
        id: "ng-project",
        group: "projects",
        label: "Project",
        value: "Campus Commute — React Native app used by about 1,200 students",
        source: "Campus Commute — a React Native app used by ~1,200 students to plan shuttle routes",
        confidence: "medium",
        hint: "“About 1,200” is your own wording. We kept the figure and did not round or extend it.",
      },
      {
        id: "ng-skills",
        group: "skills",
        label: "Skills",
        value: "TypeScript, React, Node.js, PostgreSQL, Python",
        source: "Skills: TypeScript, React, Node.js, PostgreSQL, Python",
        confidence: "high",
      },
      {
        id: "ng-cert",
        group: "skills",
        label: "Certification",
        value: "AWS Certified Cloud Practitioner (2025)",
        source: "AWS Certified Cloud Practitioner — 2025",
        confidence: "high",
      },
      {
        id: "ng-languages",
        group: "skills",
        label: "Languages",
        value: "English, Hindi, Marathi",
        source: "Languages: English (fluent), Hindi (native), Marathi (conversational)",
        confidence: "high",
      },
    ],
    openQuestions: [
      "Preferred locations and work arrangement",
      "Work authorization for roles outside India",
      "Earliest start date",
    ],
  },
  experienced: {
    documentName: "priya-nair-resume.pdf",
    groups: ["contact", "experience", "education", "skills"],
    facts: [
      {
        id: "ex-name",
        group: "contact",
        label: "Full name",
        value: "Priya Nair",
        source: "Priya Nair",
        confidence: "high",
      },
      {
        id: "ex-email",
        group: "contact",
        label: "Email",
        value: "priya.nair@example.com",
        source: "priya.nair@example.com · +91 90000 00456",
        confidence: "high",
      },
      {
        id: "ex-phone",
        group: "contact",
        label: "Phone",
        value: "+91 90000 00456",
        source: "priya.nair@example.com · +91 90000 00456",
        confidence: "high",
      },
      {
        id: "ex-location",
        group: "contact",
        label: "Location",
        value: "Bengaluru, Karnataka, India",
        source: "Bengaluru, Karnataka",
        confidence: "high",
      },
      {
        id: "ex-link",
        group: "contact",
        label: "Profile link",
        value: "linkedin.com/in/priyanair",
        source: "linkedin.com/in/priyanair",
        confidence: "medium",
        hint: "Taken from the text only. We did not open the link or check that it still works.",
      },
      {
        id: "ex-role-current",
        group: "experience",
        label: "Current role",
        value: "Senior Product Engineer — Northwind Labs, Bengaluru (March 2023 – present)",
        source: "Senior Product Engineer, Northwind Labs — Bengaluru · Mar 2023 – Present",
        confidence: "high",
      },
      {
        id: "ex-role-previous",
        group: "experience",
        label: "Previous role",
        value: "Product Engineer — Northlane, Bengaluru (July 2020 – February 2023)",
        source: "Product Engineer, Northlane — Bengaluru · Jul 2020 – Feb 2023",
        confidence: "high",
      },
      {
        id: "ex-achievement",
        group: "experience",
        label: "Achievement",
        value: "Led the billing pipeline migration to event-driven services, reducing failed renewals by 18%",
        source: "Led migration of the billing pipeline to event-driven services, cutting failed renewals by 18%",
        confidence: "medium",
        hint: "The 18% figure is copied from your resume. Confirm it before it appears in a tailored document.",
      },
      {
        id: "ex-education",
        group: "education",
        label: "Education",
        value: "B.E., Information Science — BMS College of Engineering (2020)",
        source: "B.E. Information Science, BMS College of Engineering — 2020",
        confidence: "high",
      },
      {
        id: "ex-skills",
        group: "skills",
        label: "Skills",
        value: "TypeScript, Go, PostgreSQL, Kubernetes, AWS",
        source: "TypeScript · Go · PostgreSQL · Kubernetes · AWS",
        confidence: "high",
      },
      {
        id: "ex-languages",
        group: "skills",
        label: "Languages",
        value: "English, Hindi, Malayalam",
        source: "Languages: English, Hindi, Malayalam",
        confidence: "high",
      },
    ],
    openQuestions: [
      "Notice period and earliest start date",
      "Work authorization and sponsorship needs",
      "Expected compensation (asked only when a job requires it)",
    ],
  },
};

export function isResolved(status: FactStatus): boolean {
  return status !== "suggested";
}

export function countByStatus(facts: ProfileFact[], statusOf: (id: string) => FactStatus) {
  const counts = {
    kept: 0,
    skipped: 0,
    notApplicable: 0,
    remaining: 0,
  };

  for (const fact of facts) {
    const status = statusOf(fact.id);
    if (status === "confirmed" || status === "edited") counts.kept += 1;
    else if (status === "skipped") counts.skipped += 1;
    else if (status === "not-applicable") counts.notApplicable += 1;
    else counts.remaining += 1;
  }

  return counts;
}
