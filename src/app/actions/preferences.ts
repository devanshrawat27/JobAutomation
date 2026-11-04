"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { clearMatchCache } from "@/lib/match";
import { getCurrentSession } from "@/lib/session";

const SOURCE = "Added by you during onboarding.";

const schema = z.object({
  roles: z.string().max(300).optional(),
  topSkills: z.string().max(300).optional(),
  years: z.string().max(6).optional(),
  locations: z.string().max(300).optional(),
  remote: z.string().max(1).optional(),
  currentCtc: z.string().max(10).optional(),
  expectedCtc: z.string().max(10).optional(),
  mode: z.enum(["", "onsite", "hybrid", "remote"]).optional(),
  relocate: z.enum(["", "yes", "no"]).optional(),
  availability: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  linkedin: z.string().max(200).optional(),
  github: z.string().max(200).optional(),
  portfolio: z.string().max(200).optional(),
  gender: z.string().max(40).optional(),
  disability: z.string().max(40).optional(),
  exclude: z.string().max(400).optional(),
});

type Field = {
  key: string;
  label: string;
  group: "preferences" | "contact";
  value: string;
};

/**
 * The onboarding answers, saved as confirmed facts like every other profile
 * entry. The matcher reads the preferences; contact facts feed application
 * forms. Nothing here is inferred, and blank answers delete the fact.
 */
export async function savePreferences(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent("/onboarding/preferences")}`);

  const parsed = schema.safeParse({
    roles: String(formData.get("roles") ?? ""),
    topSkills: String(formData.get("topSkills") ?? ""),
    years: String(formData.get("years") ?? ""),
    locations: String(formData.get("locations") ?? ""),
    remote: String(formData.get("remote") ?? ""),
    currentCtc: String(formData.get("currentCtc") ?? ""),
    expectedCtc: String(formData.get("expectedCtc") ?? ""),
    mode: String(formData.get("mode") ?? ""),
    relocate: String(formData.get("relocate") ?? ""),
    availability: String(formData.get("availability") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    linkedin: String(formData.get("linkedin") ?? ""),
    github: String(formData.get("github") ?? ""),
    portfolio: String(formData.get("portfolio") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    disability: String(formData.get("disability") ?? ""),
    exclude: String(formData.get("exclude") ?? ""),
  });
  if (!parsed.success) redirect("/onboarding/preferences?error=1");

  const data = parsed.data;
  const remote = data.remote === "1";
  const locations = [data.locations?.trim(), remote ? "Remote" : ""]
    .filter(Boolean)
    .join(", ");

  const fields: Field[] = [
    { key: "preferences.targetRoles", label: "Target roles", group: "preferences", value: data.roles ?? "" },
    { key: "preferences.topSkills", label: "Top skills", group: "preferences", value: data.topSkills ?? "" },
    { key: "preferences.years", label: "Total years of experience", group: "preferences", value: data.years ?? "" },
    { key: "preferences.locations", label: "Preferred locations", group: "preferences", value: locations },
    { key: "preferences.currentCtc", label: "Current CTC (LPA)", group: "preferences", value: data.currentCtc ?? "" },
    { key: "preferences.expectedCtc", label: "Expected CTC (LPA)", group: "preferences", value: data.expectedCtc ?? "" },
    { key: "preferences.workMode", label: "Work mode", group: "preferences", value: data.mode ?? "" },
    { key: "preferences.relocate", label: "Willing to relocate", group: "preferences", value: data.relocate ?? "" },
    { key: "preferences.availability", label: "When I can start", group: "preferences", value: data.availability ?? "" },
    { key: "preferences.gender", label: "Gender (for application forms)", group: "preferences", value: data.gender ?? "" },
    {
      key: "preferences.disability",
      label: "Disability status (for application forms)",
      group: "preferences",
      value: data.disability ?? "",
    },
    { key: "preferences.exclude", label: "Excluded companies or words", group: "preferences", value: data.exclude ?? "" },
    { key: "contact.phone", label: "Phone", group: "contact", value: data.phone ?? "" },
    { key: "contact.linkedin", label: "LinkedIn", group: "contact", value: data.linkedin ?? "" },
    { key: "contact.github", label: "GitHub", group: "contact", value: data.github ?? "" },
    { key: "contact.website", label: "Portfolio or website", group: "contact", value: data.portfolio ?? "" },
  ];

  const userId = session.user.id;
  const existing = await prisma.profileFact.findMany({
    where: { userId, key: { in: fields.map((field) => field.key) } },
    select: { id: true, key: true },
  });
  const byKey = new Map(existing.map((fact) => [fact.key, fact.id]));

  const writes = [];
  let position = 100;
  for (const field of fields) {
    const value = field.value.trim();
    const id = byKey.get(field.key);
    position += 1;

    if (!value) {
      if (id) writes.push(prisma.profileFact.delete({ where: { id } }));
      continue;
    }

    writes.push(
      prisma.profileFact.upsert({
        where: { userId_key: { userId, key: field.key } },
        create: {
          userId,
          key: field.key,
          groupId: field.group,
          label: field.label,
          value,
          sourceText: SOURCE,
          confidence: "high",
          status: "CONFIRMED",
          position,
          reviewedAt: new Date(),
        },
        update: {
          groupId: field.group,
          label: field.label,
          value,
          status: "CONFIRMED",
          reviewedAt: new Date(),
        },
      }),
    );
  }

  const legacy = await prisma.profileFact.findMany({
    where: { userId, key: "preferences.minSalary" },
    select: { id: true },
  });

  if (writes.length > 0 || legacy.length > 0) {
    await prisma.$transaction([
      ...writes,
      ...legacy.map((fact) => prisma.profileFact.delete({ where: { id: fact.id } })),
    ]);
  }

  clearMatchCache(userId);
  revalidatePath("/profile");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect("/onboarding/first-match");
}
