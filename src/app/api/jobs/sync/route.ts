import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { lastScan, scanBoards } from "@/lib/jobs/ingest";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scan the public boards and store the result.
 *
 * The scheduled worker authenticates with a server-only secret. Without one
 * configured this endpoint fails closed: a public URL must never be able to
 * trigger external fetches. A signed-in user can still scan manually through
 * the server action on /jobs, which is rate limited and session checked.
 */

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function presentedSecret(request: Request): string | null {
  const header = request.headers.get("x-worker-secret")?.trim();
  if (header) return header;
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

export async function POST(request: Request) {
  const expected = process.env["JOBS_WORKER_SECRET"]?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "scanner secret is not configured" },
      { status: 503 },
    );
  }
  if (!sameSecret(presentedSecret(request), expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await scanBoards("worker");
    if (!summary) {
      return NextResponse.json({ ok: false, error: "a scan is already running" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "scan failed" },
      { status: 500 },
    );
  }
}

/** Last-scan health is readable by any signed-in user; it contains no postings. */
export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const scan = await lastScan();
  return NextResponse.json({
    ok: true,
    lastScan: scan
      ? {
          endedAt: scan.endedAt,
          seen: scan.seen,
          created: scan.created,
          updated: scan.updated,
          closed: scan.closed,
          errors: scan.errors,
        }
      : null,
  });
}
