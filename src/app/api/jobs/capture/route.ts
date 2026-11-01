import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { seniorityOf } from "@/lib/jobs/match";
import { extractSkills } from "@/lib/jobs/skills";
import { requiredYears } from "@/lib/match/experience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The browser extension sends the job the candidate is looking at.
 *
 * This is the honest answer to "can you read LinkedIn or X?": no, those sites
 * refuse automated reads and their terms forbid it. What the candidate can
 * already see in their own logged-in session, they can save in one click.
 */

const schema = z.object({
  url: z.string().trim().url().max(2000),
  title: z.string().trim().min(2).max(200),
  company: z.string().trim().max(120).optional(),
  location: z.string().trim().max(160).optional(),
  text: z.string().trim().max(14_000),
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-capture-token",
  "access-control-allow-methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const token = request.headers.get("x-capture-token")?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing token" }, { status: 401, headers: CORS });
  }

  const user = await prisma.user.findUnique({ where: { captureToken: token }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "unknown token" }, { status: 401, headers: CORS });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400, headers: CORS });
  }

  const { url, title, company, location, text } = parsed.data;
  const description = text.slice(0, 14_000);
  const hash = `captured-${Buffer.from(url).toString("base64url").slice(0, 24)}`;
  const postedAt = new Date();

  const existing = await prisma.jobPosting.findFirst({
    where: { board: "captured", url },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, id: existing.id }, { headers: CORS });
  }

  const created = await prisma.jobPosting.create({
    data: {
      source: "captured",
      board: "captured",
      externalId: hash,
      company: company?.slice(0, 120) || "Saved from browser",
      title: title.slice(0, 200),
      location: location?.slice(0, 160) || null,
      department: null,
      url,
      description,
      skills: extractSkills(`${title} ${description}`, 20),
      seniority: seniorityOf(`${title} ${description.slice(0, 600)}`),
      yearsMin: requiredYears(`${title} ${description.slice(0, 1200)}`),
      remote: /\bremote\b|work from home|anywhere/i.test(`${location ?? ""} ${title}`),
      postedAt,
      hash,
      lastSeenAt: postedAt,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id }, { headers: CORS });
}
