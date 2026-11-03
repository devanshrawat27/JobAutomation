import "server-only";

import { prisma } from "@/lib/db";
import { medianSalary } from "@/lib/jobs/salary";
import { visiblePostings } from "@/lib/jobs/visibility";
import { listingWindowWhere } from "@/lib/jobs/window";

/** A URL-safe company key: "JP Morgan Chase" → "jp-morgan-chase". */
export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type CompanySummary = {
  slug: string;
  name: string;
  openRoles: number;
};

export type CompanyPage = CompanySummary & {
  postings: Array<{
    id: string;
    board: string;
    externalId: string;
    title: string;
    location: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    postedAt: Date | null;
    firstSeenAt: Date;
  }>;
};

const PUBLIC = {
  closedAt: null,
  AND: [visiblePostings(null), listingWindowWhere()],
};

/** Companies with open public roles, most roles first. */
export async function listCompanies(limit = 60): Promise<CompanySummary[]> {
  const rows = await prisma.jobPosting.groupBy({
    by: ["company"],
    where: PUBLIC,
    _count: { company: true },
    orderBy: { _count: { company: "desc" } },
    take: limit,
  });

  return rows.map((row) => ({
    slug: companySlug(row.company),
    name: row.company,
    openRoles: row._count.company,
  }));
}

/** One company page, resolved by slug. Private captures are never included. */
export async function getCompany(slug: string): Promise<CompanyPage | null> {
  const names = await prisma.jobPosting.findMany({
    where: PUBLIC,
    distinct: ["company"],
    select: { company: true },
    take: 5000,
  });
  const match = names.find((row) => companySlug(row.company) === slug);
  if (!match) return null;

  const [postings, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { ...PUBLIC, company: match.company },
      orderBy: [{ postedAt: "desc" }, { firstSeenAt: "desc" }],
      take: 100,
      select: {
        id: true,
        board: true,
        externalId: true,
        title: true,
        location: true,
        salaryMin: true,
        salaryMax: true,
        postedAt: true,
        firstSeenAt: true,
      },
    }),
    prisma.jobPosting.count({ where: { ...PUBLIC, company: match.company } }),
  ]);

  return {
    slug,
    name: match.company,
    openRoles: total,
    postings,
  };
}

/** Median pay across a company's postings, or null when none state it. */
export function companyMedianPay(postings: CompanyPage["postings"]): number | null {
  return medianSalary(
    postings
      .map((posting) => posting.salaryMax ?? posting.salaryMin)
      .filter((value): value is number => value !== null),
  );
}
