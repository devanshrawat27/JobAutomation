import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { buildAnswers } from "@/lib/form/answers";
import { BOARDS } from "@/lib/jobs/boards";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only answer set for one posting, for a permission-scoped browser
 * assistant. Session-authenticated; it never writes and never submits anything.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const boardToken = url.searchParams.get("board") ?? "";
  const postingId = url.searchParams.get("id") ?? "";

  if (!BOARDS.some((board) => board.token === boardToken)) {
    return NextResponse.json({ error: "unknown-board" }, { status: 400 });
  }
  if (!/^\d{1,20}$/.test(postingId)) {
    return NextResponse.json({ error: "invalid-id" }, { status: 400 });
  }

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
    orderBy: { position: "asc" },
    select: { key: true, label: true, value: true },
  });

  return NextResponse.json(
    {
      version: 1,
      posting: { board: boardToken, id: postingId },
      generatedAt: new Date().toISOString(),
      factCount: facts.length,
      answers: buildAnswers(facts),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
