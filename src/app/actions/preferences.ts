"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { clearMatchCache } from "@/lib/match";
import { getCurrentSession } from "@/lib/session";

const SOURCE = "Added by you on your profile for application forms.";

const schema = z.object({
  roles: z.string().max(240).optional(),
  locations: z.string().max(240).optional(),
  mode: z.enum(["", "onsite", "hybrid", "remote"]).optional(),
  salary: z.string().max(10).optional(),
  exclude: z.string().max(400).optional(),
});

const FIELDS = [
  { key: "preferences.targetRoles", label: "Target roles" },
  { key: "preferences.locations", label: "Preferred locations" },
  { key: "preferences.workMode", label: "Work mode" },
  { key: "preferences.minSalary", label: "Minimum salary (LPA)" },
  { key: "preferences.exclude", label: "Excluded companies or words" },
] as const;

/**
 * Save what the candidate wants, as confirmed facts like every other profile
 * entry. The matcher reads these; nothing is inferred from a resume line.
 */
export async function savePreferences(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent("/onboarding/preferences")}`);

  const parsed = schema.safeParse({
    roles: String(formData.get("roles") ?? ""),
    locations: String(formData.get("locations") ?? ""),
    mode: String(formData.get("mode") ?? ""),
    salary: String(formData.get("salary") ?? ""),
    exclude: String(formData.get("exclude") ?? ""),
  });
  if (!parsed.success) redirect("/onboarding/preferences?error=1");

  const values: Record<string, string> = {
    "preferences.targetRoles": (parsed.data.roles ?? "").trim(),
    "preferences.locations": (parsed.data.locations ?? "").trim(),
    "preferences.workMode": (parsed.data.mode ?? "").trim(),
    "preferences.minSalary": (parsed.data.salary ?? "").trim(),
    "preferences.exclude": (parsed.data.exclude ?? "").trim(),
  };

  const userId = session.user.id;
  const existing = await prisma.profileFact.findMany({
    where: { userId, key: { in: FIELDS.map((field) => field.key) } },
    select: { id: true, key: true },
  });
  const byKey = new Map(existing.map((fact) => [fact.key, fact.id]));

  const writes = [];
  for (const field of FIELDS) {
    const value = values[field.key];
    const id = byKey.get(field.key);

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
          groupId: "preferences",
          label: field.label,
          value,
          sourceText: SOURCE,
          confidence: "high",
          status: "CONFIRMED",
          position: 100 + FIELDS.indexOf(field),
          reviewedAt: new Date(),
        },
        update: { value, status: "CONFIRMED", reviewedAt: new Date() },
      }),
    );
  }

  if (writes.length > 0) await prisma.$transaction(writes);

  clearMatchCache(userId);
  revalidatePath("/profile");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
