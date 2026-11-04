import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { parseDateRange, totalMonths, type DateRange } from "@/lib/match/experience";
import { getCurrentSession } from "@/lib/session";
import PreferencesWizard from "./preferences-wizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your job preferences — JobAutomation" };

const GENERIC_SKILLS = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "React.js",
  "Next.js",
  "Node.js",
  "SQL",
  "PostgreSQL",
  "Docker",
];

function listFrom(values: string[]): string[] {
  const out = new Set<string>();
  for (const value of values) {
    for (const part of value.split(/[,;\n·|]/)) {
      const item = part.trim();
      if (item.length >= 2 && item.length <= 40) out.add(item);
    }
  }
  return [...out];
}

function roleSuggestions(labels: string[], values: string[]): string[] {
  const out = new Set<string>();
  const add = (value: string | undefined) => {
    const text = value?.trim() ?? "";
    if (text.length > 2 && text.length <= 60) out.add(text);
  };

  for (const value of values) {
    for (const line of value.split("\n")) add(line.split("—")[1]);
  }
  for (const label of labels) {
    add(label.split("—")[1]);
  }

  return [...out].slice(0, 6);
}

export default async function PreferencesPage() {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect(`/sign-in?next=${encodeURIComponent("/onboarding/preferences")}`);
  }

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id },
    orderBy: [{ position: "asc" }],
    select: { groupId: true, key: true, label: true, value: true, status: true },
  });
  const confirmed = facts.filter((fact) => fact.status === "CONFIRMED" || fact.status === "EDITED");

  if (confirmed.length === 0) redirect("/onboarding");

  const byKey = new Map<string, string>();
  for (const fact of facts) {
    if (fact.status === "CONFIRMED" || fact.status === "EDITED") byKey.set(fact.key, fact.value);
  }

  const skillValues = confirmed
    .filter((fact) => fact.groupId === "skills")
    .map((fact) => fact.value);
  const contactValues = confirmed
    .filter((fact) => fact.groupId === "contact")
    .map((fact) => fact.value);
  const experience = confirmed.filter((fact) => fact.groupId === "experience");

  const knownSkills = [
    ...new Set([
      ...listFrom(skillValues),
      ...listFrom(contactValues.filter((value) => value.length < 50 && !/@|https?:/.test(value))),
    ]),
  ].slice(0, 40);

  const roles = roleSuggestions(
    experience.map((fact) => fact.label),
    experience.map((fact) => fact.value),
  );

  const location = byKey.get("contact.location") ?? "";
  const cityFromProfile = /bengaluru|bangalore|mumbai|pune|delhi|gurugram|noida|hyderabad|chennai|kolkata|ahmedabad/i.exec(
    `${location} ${byKey.get("contact.city") ?? ""}`,
  )?.[0];

  // Like their step 03, prefill total years from the dates already confirmed
  // on the profile. It stays editable and is only saved if the candidate
  // accepts it.
  const ranges: DateRange[] = [];
  for (const fact of experience) {
    if (fact.key.startsWith("preferences.")) continue;
    for (const line of fact.value.split("\n")) {
      const range = parseDateRange(line);
      if (range) ranges.push(range);
    }
  }
  const derivedYears = Math.round((totalMonths(ranges) / 12) * 10) / 10;

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">Onboarding · 6 short steps</span>
      </header>

      <PreferencesWizard
        initial={{
          roles: byKey.get("preferences.targetRoles") ?? "",
          topSkills: byKey.get("preferences.topSkills") ?? "",
          years: byKey.get("preferences.years") ?? (derivedYears > 0 ? String(derivedYears) : ""),
          locations: byKey.get("preferences.locations") ?? "",
          remote: /remote/i.test(byKey.get("preferences.locations") ?? "") ||
            /remote/i.test(byKey.get("preferences.workMode") ?? ""),
          currentCtc: byKey.get("preferences.currentCtc") ?? "",
          fresher: byKey.get("preferences.currentCtc") === "0",
          expectedCtc: byKey.get("preferences.expectedCtc") ?? byKey.get("preferences.minSalary") ?? "",
          mode: byKey.get("preferences.workMode") ?? "",
          relocate: byKey.get("preferences.relocate") ?? "",
          availability: byKey.get("preferences.availability") ?? "",
          phone: byKey.get("contact.phone") ?? "",
          linkedin: byKey.get("contact.linkedin") ?? "",
          github: byKey.get("contact.github") ?? "",
          portfolio: byKey.get("contact.website") ?? "",
          gender: byKey.get("preferences.gender") ?? "",
          disability: byKey.get("preferences.disability") ?? "",
          exclude: byKey.get("preferences.exclude") ?? "",
        }}
        knownSkills={knownSkills.length > 0 ? knownSkills : GENERIC_SKILLS}
        suggestedRoles={roles}
        suggestedCity={cityFromProfile ?? "Bengaluru"}
        hasResume={experience.length > 0 || skillValues.length > 0}
      />
    </main>
  );
}
