"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { seniorityOf } from "@/lib/jobs/match";
import { extractSkills } from "@/lib/jobs/skills";
import { requiredYears } from "@/lib/match/experience";
import { getCurrentSession } from "@/lib/session";

/**
 * Add a hiring post the candidate found themselves.
 *
 * LinkedIn, X and Reddit all refuse unauthenticated reads, and scraping around
 * that would break their terms. This is the honest path: paste the post, and it
 * joins the same corpus, the same matcher and the same cards as every board.
 */

const schema = z.object({
  url: z.string().trim().url().max(2000),
  text: z.string().trim().min(40).max(12_000),
  company: z.string().trim().max(80).optional(),
  title: z.string().trim().max(160).optional(),
});

const ROLE =
  /\b(engineer|developer|designer|manager|analyst|scientist|architect|intern|devops|sre|researcher|marketer|writer|recruiter|consultant|lead|fresher)\b/i;
const REMOTE = /\b(remote|wfh|work from home|anywhere)\b/i;
const CITIES =
  /\b(bengaluru|bangalore|mumbai|pune|delhi|gurugram|noida|hyderabad|chennai|kolkata|ahmedabad|jaipur|indore|kochi|india)\b/i;

function firstLine(text: string): string {
  return text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

export async function addHiringPost(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in?next=%2Fjobs");

  const parsed = schema.safeParse({
    url: formData.get("url"),
    text: formData.get("text"),
    company: String(formData.get("company") ?? "").trim() || undefined,
    title: String(formData.get("title") ?? "").trim() || undefined,
  });

  if (!parsed.success) redirect("/jobs?error=post");
  const { url, text } = parsed.data;

  const title =
    parsed.data.title && ROLE.test(parsed.data.title)
      ? parsed.data.title.slice(0, 160)
      : (firstLine(text).replace(/^\[?\s*(hiring|we[’']?re hiring)\s*\]?[:\s-]*/i, "").slice(0, 160) ||
        "Hiring post");

  const company = parsed.data.company?.slice(0, 80) || "Pasted post";
  const location = REMOTE.test(text.slice(0, 500))
    ? "Remote"
    : CITIES.test(text.slice(0, 500))
      ? "India"
      : null;

  const externalId = `${Date.now()}-${url.length}`;
  const description = text.slice(0, 12_000);
  const hash = `manual-${externalId}`;
  const postedAt = new Date();

  await prisma.jobPosting.create({
    data: {
      source: "manual",
      board: "pasted",
      externalId,
      ownerUserId: session.user.id,
      company,
      title,
      location,
      department: null,
      url,
      description,
      skills: extractSkills(`${title} ${description}`, 20),
      seniority: seniorityOf(`${title} ${description.slice(0, 600)}`),
      yearsMin: requiredYears(`${title} ${description.slice(0, 1200)}`),
      remote: REMOTE.test(text),
      postedAt,
      hash,
      lastSeenAt: postedAt,
    },
  });

  revalidatePath("/jobs");
  redirect("/jobs?view=for-you");
}
