"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { isApplicationStatus } from "@/lib/applications/status";
import { getCurrentSession } from "@/lib/session";

const noteSchema = z.string().max(600).optional();

/**
 * Track a prepared document as an application, pinning what it was built from:
 * a hash of the confirmed facts and the document's edit time at that moment.
 */
export async function createApplication(formData: FormData): Promise<void> {
  const documentId = String(formData.get("documentId") ?? "");
  const backTo = `/documents/${encodeURIComponent(documentId)}`;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(backTo)}`);

  const document = await prisma.document.findFirst({
    where: { id: documentId, userId: session.user.id },
  });
  if (!document) redirect("/documents");

  const existing = await prisma.application.findFirst({
    where: { userId: session.user.id, postingId: document.postingId },
    select: { id: true },
  });
  if (existing) redirect(`/applications/${existing.id}`);

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
    orderBy: { position: "asc" },
    select: { key: true, label: true, value: true },
  });

  const profileHash = createHash("sha256")
    .update(facts.map((fact) => `${fact.key}:${fact.value}`).join("\n"))
    .digest("hex")
    .slice(0, 16);

  const application = await prisma.application.create({
    data: {
      userId: session.user.id,
      postingId: document.postingId,
      postingUrl: document.postingUrl,
      postingTitle: document.postingTitle,
      company: document.company,
      documentId: document.id,
      profileFactCount: facts.length,
      profileHash,
      profileSnapshot: facts,
      documentEditedAt: document.editedAt ?? document.createdAt,
      events: {
        create: {
          status: "PREPARED",
          note: `Tracked from a ${document.kind === "RESUME" ? "tailored resume" : "cover letter"} (profile ${profileHash}).`,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/applications");
  redirect(`/applications/${application.id}`);
}

export async function setApplicationStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const rawStatus = String(formData.get("status") ?? "");
  const note = noteSchema.safeParse(String(formData.get("note") ?? "") || undefined);

  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in");

  if (!isApplicationStatus(rawStatus)) redirect(`/applications/${encodeURIComponent(id)}?error=status`);

  const application = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!application) redirect("/applications");

  await prisma.$transaction([
    prisma.application.update({
      where: { id: application.id },
      data: {
        status: rawStatus,
        statusChangedAt: new Date(),
        ...(note.success && note.data ? { note: note.data } : {}),
      },
    }),
    prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        status: rawStatus,
        note: note.success ? note.data ?? null : null,
      },
    }),
  ]);

  revalidatePath("/applications");
  revalidatePath(`/applications/${application.id}`);
  redirect(`/applications/${application.id}?updated=1`);
}


const prioritySchema = z.coerce.number().int().min(0).max(5);

/** Rate how much an application matters. Zero clears the rating. */
export async function setApplicationPriority(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in?next=%2Fapplications");

  const id = String(formData.get("id") ?? "");
  const parsed = prioritySchema.safeParse(formData.get("priority") ?? 0);
  if (!id || !parsed.success) redirect("/applications");

  await prisma.application.updateMany({
    where: { id, userId: session.user.id },
    data: { priority: parsed.data },
  });

  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
}
