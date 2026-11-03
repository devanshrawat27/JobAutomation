import Link from "next/link";

import { listCompanies } from "@/lib/jobs/company";

export const dynamic = "force-dynamic";

export const metadata = { title: "Companies hiring — JobAutomation" };

export default async function CompaniesPage() {
  const companies = await listCompanies(60);

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          <Link href="/jobs">All jobs</Link>
        </span>
      </header>

      <section aria-labelledby="companies-title" className="onboarding-content onboarding-content-wide">
        <p className="section-kicker">Employers</p>
        <h1 id="companies-title">Companies hiring now</h1>
        <p className="onboarding-intro">
          Every employer here publishes its roles on its own board. Counts are open postings from the last fourteen days,
          most first.
        </p>

        {companies.length === 0 ? (
          <div className="profile-empty">
            <p>The corpus is empty until the first scan finishes.</p>
            <Link className="intake-secondary" href="/jobs">Open jobs</Link>
          </div>
        ) : (
          <ul className="company-list">
            {companies.map((company) => (
              <li key={company.slug}>
                <Link href={`/company/${company.slug}`}>{company.name}</Link>
                <span>{company.openRoles} open</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
