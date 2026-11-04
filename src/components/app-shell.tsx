import Link from "next/link";

import SignOutButton from "@/components/sign-out-button";
import { prisma } from "@/lib/db";
import { visiblePostings } from "@/lib/jobs/detail";
import { buildCandidate } from "@/lib/jobs/match";
import { listingWindowWhere } from "@/lib/jobs/window";
import { getCurrentSession } from "@/lib/session";

type Active = "dashboard" | "profile" | "jobs" | "documents" | "applications" | "digest";

const ICONS = {
  overview: (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="15">
      <rect height="5" rx="1" width="5" x="2" y="2" />
      <rect height="5" rx="1" width="5" x="9" y="2" />
      <rect height="5" rx="1" width="5" x="2" y="9" />
      <rect height="5" rx="1" width="5" x="9" y="9" />
    </svg>
  ),
  jobs: (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="15">
      <rect height="8" rx="1.2" width="12" x="2" y="5" />
      <path d="M5.6 5V3.6a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1V5M2 8.4h12" />
    </svg>
  ),
  applications: (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="15">
      <path d="M14 2 6.6 9.4" />
      <path d="M14 2 9.7 14l-3.1-4.6L2 6.3 14 2Z" />
    </svg>
  ),
  documents: (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="15">
      <path d="M4 2h5l3 3v9H4V2Z" />
      <path d="M9 2v3h3M6.2 8h3.6M6.2 10.6h3.6" />
    </svg>
  ),
  profile: (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="15">
      <circle cx="8" cy="5.4" r="2.6" />
      <path d="M2.9 13.4c0-2.5 2.3-4 5.1-4s5.1 1.5 5.1 4" />
    </svg>
  ),
  digest: (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="15">
      <rect height="11" rx="1.4" width="12" x="2" y="3" />
      <path d="M2 6.4h12M5.4 2v2.2M10.6 2v2.2M5.2 9.2h2.2" />
    </svg>
  ),
} as const;

const LINKS: Array<{ key: Active; href: string; label: string; hint: string; icon: keyof typeof ICONS }> = [
  { key: "dashboard", href: "/dashboard", label: "Overview", hint: "What needs you today", icon: "overview" },
  { key: "jobs", href: "/jobs", label: "Discover jobs", hint: "Live roles, ranked for you", icon: "jobs" },
  { key: "applications", href: "/applications", label: "Applications", hint: "What you sent, when", icon: "applications" },
  { key: "documents", href: "/documents", label: "Documents", hint: "Resumes and letters", icon: "documents" },
  { key: "profile", href: "/profile", label: "My profile", hint: "The facts every answer cites", icon: "profile" },
  { key: "digest", href: "/digest", label: "Daily digest", hint: "What changed since last time", icon: "digest" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "JA";
}

/**
 * The signed-in shell: a persistent sidebar with the candidate's own summary,
 * the four work areas, and live counts. Marketing pages stay outside it.
 */
export default async function AppShell({
  active,
  children,
}: {
  active: Active;
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  const [facts, liveJobs, documents, applications] = await Promise.all([
    session?.user
      ? prisma.profileFact.findMany({
          where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
          select: { label: true, value: true, groupId: true },
        })
      : Promise.resolve([]),
    prisma.jobPosting.count({
      where: {
        closedAt: null,
        AND: [visiblePostings(session?.user?.id ?? null), listingWindowWhere()],
      },
    }),
    session?.user ? prisma.document.count({ where: { userId: session.user.id } }) : Promise.resolve(0),
    session?.user ? prisma.application.count({ where: { userId: session.user.id } }) : Promise.resolve(0),
  ]);

  const candidate = buildCandidate(facts.map((fact) => ({ label: fact.label, value: fact.value, group: fact.groupId })));
  const nameFact = facts.find((fact) => /full name|^name$/i.test(fact.label));
  const name = nameFact?.value ?? "Your profile";
  const headline = candidate.student
    ? `Student${candidate.graduationYear ? ` · class of ${candidate.graduationYear}` : ""}`
    : candidate.years > 0
      ? `${candidate.years} years · ${candidate.family ?? "profile"}`
      : "No profile yet";

  const AREAS = [
    ["contact", "Contact"],
    ["education", "Education"],
    ["experience", "Experience"],
    ["projects", "Projects"],
    ["skills", "Skills"],
  ] as const;

  const filled = AREAS.filter(([id]) => facts.some((fact) => fact.groupId === id)).map(([, label]) => label);
  const missing = AREAS.filter(([id]) => !facts.some((fact) => fact.groupId === id)).map(([, label]) => label);
  const completeness = Math.round((filled.length / AREAS.length) * 100);

  const counts: Record<Active, number | null> = {
    dashboard: null,
    digest: null,
    profile: facts.length || null,
    jobs: liveJobs,
    documents: documents || null,
    applications: applications || null,
  };

  return (
    <div className="app-shell">
      <aside className="app-side">
        <Link className="app-brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            <span />
          </span>
          <span>jobautomation</span>
        </Link>

        <nav aria-label="Workspace" className="app-nav">
          {LINKS.map((link) => (
            <Link
              className={`app-nav-link${active === link.key ? " is-active" : ""}`}
              href={link.href}
              key={link.key}
              title={link.hint}
            >
              <span aria-hidden="true" className="app-nav-icon">{ICONS[link.icon]}</span>
              <span className="app-nav-label">{link.label}</span>
              {counts[link.key] !== null ? <span className="app-nav-count">{counts[link.key]}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="app-side-bottom">
          {facts.length > 0 ? (
            <div className="app-progress" aria-label="Profile completeness">
              <div className="app-progress-head">
                <span>Profile</span>
                <strong>{filled.length} of {AREAS.length} areas</strong>
              </div>
              <div className="app-progress-track">
                <span style={{ width: `${completeness}%` }} />
              </div>
              {missing.length > 0 ? (
                <p className="app-progress-note">
                  Still empty: {missing.slice(0, 3).join(", ")}
                  {missing.length > 3 ? ` +${missing.length - 3}` : ""}
                </p>
              ) : (
                <p className="app-progress-note">Every area is filled.</p>
              )}
            </div>
          ) : null}

          <div className="app-side-foot">
            {session?.user ? (
              <div className="app-account">
                <Link className="app-account-user" href="/profile">
                  <span aria-hidden="true" className="app-avatar">
                    {initials(name)}
                  </span>
                  <span className="app-user-body">
                    <strong>{name}</strong>
                    <small>{headline}</small>
                  </span>
                </Link>
                <div className="app-account-meta">
                  <span className="app-user-email" title={session.user.email}>
                    {session.user.email}
                  </span>
                  <SignOutButton />
                </div>
              </div>
            ) : (
              <Link className="app-side-cta" href="/onboarding/resume?path=new-grad">
                Add your resume
              </Link>
            )}
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <Link className="app-brand app-brand--compact" href="/">
            <span aria-hidden="true" className="brand-mark">
              <span />
            </span>
            <span>jobautomation</span>
          </Link>
          <nav aria-label="Workspace" className="app-topnav">
            {LINKS.map((link) => (
              <Link className={active === link.key ? "is-active" : ""} href={link.href} key={link.key}>
                {link.label}
              </Link>
            ))}
          </nav>
          {session?.user ? <SignOutButton /> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
