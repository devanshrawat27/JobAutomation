"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { clearMatchCache } from "@/lib/match";
import { getCurrentSession } from "@/lib/session";

const schema = z.object({
  id: z.string().min(3).max(60),
  label: z.string().min(2).max(80),
  group: z.enum(["contact", "education", "experience", "eligibility", "preferences"]),
  value: z.string().trim().min(1).max(300),
});

/**
 * Answers a form question the resume never covered — notice period, visa
 * sponsorship, expected CTC — and keeps it on the profile so every later
 * application can reuse it. The candidate typed it; the product never infers it.
 */
export async function saveFormDetail(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in?next=%2Fprofile");

  const parsed = schema.safeParse({
    id: formData.get("id"),
    label: formData.get("label"),
    group: formData.get("group"),
    value: formData.get("value"),
  });
  if (!parsed.success) redirect("/profile?error=detail");

  const { id, label, group, value } = parsed.data;
  const key = `form.${id}`;
  const userId = session.user.id;

  const last = await prisma.profileFact.findFirst({
    where: { userId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.profileFact.upsert({
    where: { userId_key: { userId, key } },
    create: {
      userId,
      key,
      groupId: group,
      label,
      value,
      sourceText: "Added by you on your profile for application forms.",
      confidence: "high",
      status: "CONFIRMED",
      position: (last?.position ?? 0) + 1,
      reviewedAt: new Date(),
    },
    update: { value, status: "CONFIRMED", reviewedAt: new Date() },
  });

  clearMatchCache(userId);
  revalidatePath("/profile");
}
