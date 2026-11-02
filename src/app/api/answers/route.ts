import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { buildAnswers } from "@/lib/form/answers";
import { getJobDetail } from "@/lib/jobs/detail";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only answer set for one posting, for a permission-scoped browser
 * assistant. Session-authenticated; it never writes and never submits anything.
 *
 * The posting is resolved the same way every page resolves it: the stored row
 * first (any source), the board only when the row is absent. A private posting
 * belonging to another account is indistinguishable from a missing one.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const boardToken = (url.searchParams.get("board") ?? "").trim();
  const postingId = (url.searchParams.get("id") ?? "").trim();

  if (!boardToken || !postingId) {
    return NextResponse.json({ error: "missing-posting" }, { status: 400 });
  }

  const detail = await getJobDetail(boardToken, postingId, session.user.id).catch(() => null);
  if (!detail) return NextResponse.json({ error: "posting-not-found" }, { status: 404 });

  const facts = await prisma.profileFact.findMany({
    where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
    orderBy: { position: "asc" },
    select: { key: true, label: true, value: true },
  });

  return NextResponse.json(
    {
      version: 1,
      posting: {
        board: boardToken,
        id: postingId,
        title: detail.posting.title,
        company: detail.posting.company,
        url: detail.posting.url,
      },
      generatedAt: new Date().toISOString(),
      factCount: facts.length,
      answers: buildAnswers(facts),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
