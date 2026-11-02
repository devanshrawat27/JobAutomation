import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { importJobLink } from "@/lib/jobs/import-link";
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
  text: z.string().trim().max(14_000).optional(),
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

  const { url } = parsed.data;
  let { title, company, location } = parsed.data;
  let text = parsed.data.text ?? "";

  // A Greenhouse application page has the form but not the posting, and an
  // extension user often saves from exactly there. If the page text is thin or
  // looks like a form, ask the ATS for the posting itself.
  const formLike =
    text.length < 240 ||
    /indicate a required field|first name\s*\*|last name\s*\*|resume\/cv\s*\*|submit application/i.test(text.slice(0, 600));

  if (formLike) {
    const resolved = await importJobLink(url);
    if (resolved.ok) {
      title = resolved.job.title;
      company = resolved.job.company;
      location = resolved.job.location ?? location;
      text = resolved.job.content;
    }
  }

  if (!title || text.trim().length < 40) {
    return NextResponse.json(
      { ok: false, error: "could not read this posting" },
      { status: 422, headers: CORS },
    );
  }

  const description = text.slice(0, 14_000);
  // The id is per account as well, so two candidates saving the same URL keep
  // separate private rows instead of colliding on the corpus unique key.
  const hash = `captured-${Buffer.from(url).toString("base64url").slice(0, 24)}-${user.id.slice(0, 8)}`;
  const postedAt = new Date();

  const existing = await prisma.jobPosting.findFirst({
    // Duplicate detection is per account: a capture is that candidate's own
    // material, so another user's saved copy must never answer for it.
    where: { board: "captured", url, ownerUserId: user.id },
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
      ownerUserId: user.id,
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
