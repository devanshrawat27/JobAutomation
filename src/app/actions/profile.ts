"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { FactStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { clearMatchCache } from "@/lib/match";
import { planMerge, type MergeIncomingFact } from "@/lib/resume/merge-profile";
import { getCurrentSession } from "@/lib/session";

const factSchema = z.object({
  key: z.string().min(1).max(80),
  groupId: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(2000),
  sourceText: z.string().min(1).max(2000),
  confidence: z.enum(["high", "medium", "low"]),
  status: z.enum(["confirmed", "edited", "skipped", "not-applicable"]),
  hint: z.string().max(600).optional(),
});

const payloadSchema = z.array(factSchema).min(1).max(200);

export type SaveProfileResult =
  | { ok: true; saved: number; added: number; updated: number; kept: number }
  | { ok: false; reason: "unauthenticated" | "invalid-input" };

const statusToEnum = {
  confirmed: FactStatus.CONFIRMED,
  edited: FactStatus.EDITED,
  skipped: FactStatus.SKIPPED,
  "not-applicable": FactStatus.NOT_APPLICABLE,
} as const;

/**
 * Save reviewed facts for the signed-in user.
 *
 * `replace` is the first-time path: the submitted set becomes the profile.
 * `merge` is the second-resume path: unseen cards are added, recognised cards
 * are refreshed, identical cards are left alone, and nothing is deleted — so an
 * upload can never quietly drop a detail the user confirmed earlier.
 *
 * The owner always comes from the session, never from the payload.
 */
export async function saveProfileFacts(
  input: unknown,
  mode: "replace" | "merge" = "replace",
): Promise<SaveProfileResult> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, reason: "unauthenticated" };

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid-input" };

  const userId = session.user.id;
  const reviewedAt = new Date();
  const incoming: MergeIncomingFact[] = parsed.data.map((fact) => ({
    ...fact,
    hint: fact.hint ?? null,
  }));

  if (mode === "replace") {
    await prisma.$transaction([
      prisma.profileFact.deleteMany({ where: { userId } }),
      prisma.profileFact.createMany({
        data: incoming.map((fact, index) => ({
          userId,
          key: fact.key,
          groupId: fact.groupId,
          label: fact.label,
          value: fact.value,
          sourceText: fact.sourceText,
          confidence: fact.confidence,
          status: statusToEnum[fact.status as keyof typeof statusToEnum],
          hint: fact.hint ?? null,
          position: index,
          reviewedAt,
        })),
      }),
    ]);

    revalidatePath("/profile");
    clearMatchCache(userId);
    return { ok: true, saved: incoming.length, added: incoming.length, updated: 0, kept: 0 };
  }

  const existing = await prisma.profileFact.findMany({
    where: { userId },
    select: { id: true, key: true, groupId: true, label: true, value: true, position: true },
  });

  const plan = planMerge(existing, incoming);
  const nextPosition = existing.reduce((max, fact) => Math.max(max, fact.position), -1) + 1;

  const writes = [
    ...plan.update.map(({ id, fact }) =>
      prisma.profileFact.update({
        where: { id },
        data: {
          label: fact.label,
          value: fact.value,
          sourceText: fact.sourceText,
          confidence: fact.confidence,
          status: statusToEnum[fact.status as keyof typeof statusToEnum],
          hint: fact.hint ?? null,
          reviewedAt,
        },
      }),
    ),
    ...(plan.create.length > 0
      ? [
          prisma.profileFact.createMany({
            data: plan.create.map((fact, index) => ({
              userId,
              key: fact.key,
              groupId: fact.groupId,
              label: fact.label,
              value: fact.value,
              sourceText: fact.sourceText,
              confidence: fact.confidence,
              status: statusToEnum[fact.status as keyof typeof statusToEnum],
              hint: fact.hint ?? null,
              position: nextPosition + index,
              reviewedAt,
            })),
          }),
        ]
      : []),
  ];

  if (writes.length > 0) await prisma.$transaction(writes);

  revalidatePath("/profile");
  clearMatchCache(userId);
  return {
    ok: true,
    saved: plan.create.length + plan.update.length,
    added: plan.create.length,
    updated: plan.update.length,
    kept: plan.unchanged,
  };
}

/** Remove every saved fact for the signed-in user. Account deletion is separate. */
export async function deleteProfileFacts(): Promise<{ ok: boolean }> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false };

  await prisma.profileFact.deleteMany({ where: { userId: session.user.id } });
  clearMatchCache(session.user.id);
  revalidatePath("/profile");
  return { ok: true };
}
