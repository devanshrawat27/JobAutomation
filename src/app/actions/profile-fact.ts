"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { clearMatchCache } from "@/lib/match";
import { getCurrentSession } from "@/lib/session";

const STATUS = {
  confirmed: "CONFIRMED",
  skipped: "SKIPPED",
  "not-applicable": "NOT_APPLICABLE",
} as const;

/**
 * Edit one saved fact without re-uploading a resume. Only the owner can change
 * it, and the match cache is cleared so old comparisons do not linger.
 */
export async function updateProfileFact(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in?next=%2Fprofile");

  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  const rawStatus = String(formData.get("status") ?? "confirmed");

  if (!key || !value || !(rawStatus in STATUS)) return;

  const fact = await prisma.profileFact.findFirst({
    where: { userId: session.user.id, key },
    select: { id: true },
  });
  if (!fact) return;

  await prisma.profileFact.update({
    where: { id: fact.id },
    data: {
      value: value.slice(0, 2000),
      status: STATUS[rawStatus as keyof typeof STATUS],
      reviewedAt: new Date(),
    },
  });

  clearMatchCache(session.user.id);
  revalidatePath("/profile");
}
