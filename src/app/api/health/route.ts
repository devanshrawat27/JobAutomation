import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for the database connection. It returns no schema or version
 * detail so it is safe to leave reachable in development.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("Database health check failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ status: "error", database: "down" }, { status: 503 });
  }
}
