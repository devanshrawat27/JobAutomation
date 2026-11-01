import { NextResponse } from "next/server";

import { lastScan, scanBoards } from "@/lib/jobs/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scan the public boards and store the result.
 *
 * This is the endpoint the background worker calls on a timer. It is meant to
 * run on a server or a local dev machine, never in the browser.
 */
export async function POST() {
  try {
    const summary = await scanBoards();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "scan failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
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
