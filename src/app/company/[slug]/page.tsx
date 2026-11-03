import Link from "next/link";
import { notFound } from "next/navigation";

import { companyMedianPay, getCompany } from "@/lib/jobs/company";
import { formatSalary } from "@/lib/jobs/salary";

export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await getCompany(slug).catch(() => null);
  if (!company) notFound();

  const median = companyMedianPay(company.postings);
  const pay = median !== null ? `₹${Number.isInteger(median) ? median : median.toFixed(1)} LPA median` : "pay not stated";

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href="/company">All companies</Link>
        </span>
      </header>

      <section aria-labelledby="company-title" className="onboarding-content onboarding-content-wide">
        <p className="section-kicker">Employer</p>
        <h1 id="company-title">{company.name}</h1>
        <p className="onboarding-intro">
          {company.openRoles} open {company.openRoles === 1 ? "role" : "roles"} from the last fourteen days · {pay}.
          Every link goes to the employer&apos;s own posting.
        </p>

        <div className="company-actions">
          <Link className="intake-secondary" href={`/jobs?q=${encodeURIComponent(company.name)}`}>
            See these in the job list
          </Link>
        </div>

        {company.postings.length < company.openRoles ? (
          <p className="jobs-note">
            Showing the newest {company.postings.length} of {company.openRoles}.
          </p>
        ) : null}

        {company.postings.length === 0 ? (
          <div className="profile-empty">
            <p>No listed role at this company right now.</p>
            <Link className="intake-secondary" href="/company">Back to companies</Link>
          </div>
        ) : (
          <ul className="company-roles">
            {company.postings.map((posting) => (
              <li key={posting.id}>
                <div>
                  <Link href={`/jobs/${posting.board}/${posting.externalId}`}>{posting.title}</Link>
                  <p>
                    {posting.location ?? "Location not stated"}
                    {formatSalary(posting.salaryMin, posting.salaryMax)
                      ? ` · ${formatSalary(posting.salaryMin, posting.salaryMax)}`
                      : ""}
                  </p>
                </div>
                <time dateTime={(posting.postedAt ?? posting.firstSeenAt).toISOString()}>
                  {day.format(posting.postedAt ?? posting.firstSeenAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
