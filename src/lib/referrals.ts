/**
 * Everything the product can honestly offer for a referral, without touching
 * LinkedIn: three searches the candidate runs in their own session, and a
 * message written only from facts they confirmed.
 *
 * Nothing here invents a shared history. There is no "we both went to X" unless
 * the profile actually says X, and no profile is fetched or stored.
 */

export type ReferralInput = {
  company: string;
  role: string;
  name: string | null;
  city: string | null;
  college: string | null;
  skills: string[];
  years: number;
  student: boolean;
  graduationYear: number | null;
};

export type ReferralSearch = {
  label: string;
  detail: string;
  href: string;
};

export type ReferralKit = {
  searches: ReferralSearch[];
  draft: string;
};

function google(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function linkedin(query: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

/** A short role word for search queries: "Backend Engineer" from a long title. */
function roleWord(title: string): string {
  const words = title
    .replace(/[()[\],/|–—]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const keep = words.filter((word) => !/^(senior|sr|junior|jr|lead|staff|principal|ii|iii|iv|intern|internship)$/i.test(word));
  return (keep.slice(0, 3).join(" ") || words.slice(0, 2).join(" ")).trim();
}

export function buildReferralKit(input: ReferralInput): ReferralKit {
  const company = input.company.trim();
  const role = input.role.trim();
  const roleKey = roleWord(role);

  const searches: ReferralSearch[] = [
    {
      label: `People at ${company} on LinkedIn`,
      detail: `Search ${company} ${roleKey} profiles, in your own LinkedIn session.`,
      href: linkedin(`${company} ${roleKey}`),
    },
    {
      label: `Recruiters and HR at ${company}`,
      detail: "Talent teams answer candidates as part of the job.",
      href: linkedin(`${company} recruiter`),
    },
  ];

  if (input.college) {
    searches.push({
      label: `Alumni at ${company}`,
      detail: `Public profiles that mention ${input.college} and ${company}.`,
      href: google(`site:linkedin.com/in "${input.college}" "${company}"`),
    });
  } else {
    searches.push({
      label: `Public profiles at ${company}`,
      detail: "A Google search over public LinkedIn pages, opened in a new tab.",
      href: google(`site:linkedin.com/in "${company}" ${roleKey}`),
    });
  }

  const lines: string[] = [];
  const opening = input.name ? `Hi — I'm ${input.name}.` : "Hi —";
  lines.push(opening);

  const where = input.city ? ` based in ${input.city}` : "";
  if (input.student) {
    const study = input.graduationYear
      ? `I'm finishing my degree in ${input.graduationYear}${where},`
      : `I'm a student${where},`;
    lines.push(`${study} and I've applied for ${role} at ${company}.`);
  } else {
    const experience = input.years > 0 ? `I'm a ${input.years}-year engineer${where}` : `I'm an engineer${where}`;
    lines.push(`${experience}, and I've applied for ${role} at ${company}.`);
  }

  if (input.skills.length > 0) {
    lines.push(`Most of my work is ${input.skills.slice(0, 3).join(", ")}.`);
  }

  lines.push(
    "If you have a minute, would you be open to a referral, or a short chat about the team? Either way, thanks for reading.",
  );

  return { searches, draft: lines.join(" ") };
}
