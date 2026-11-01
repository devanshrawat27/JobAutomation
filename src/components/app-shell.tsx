import Link from "next/link";

import { prisma } from "@/lib/db";
import { buildCandidate } from "@/lib/jobs/match";
import { getCurrentSession } from "@/lib/session";

type Active = "profile" | "jobs" | "documents" | "applications";

const LINKS: Array<{ key: Active; href: string; label: string; hint: string }> = [
  { key: "profile", href: "/profile", label: "Profile", hint: "The facts every answer cites" },
  { key: "jobs", href: "/jobs", label: "Jobs", hint: "Live roles, ranked for you" },
  { key: "documents", href: "/documents", label: "Documents", hint: "Resumes and letters" },
  { key: "applications", href: "/applications", label: "Applications", hint: "What you sent, when" },
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
    prisma.jobPosting.count({ where: { closedAt: null } }),
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

        <Link className="app-user" href="/profile">
          <span aria-hidden="true" className="app-avatar">
            {initials(name)}
          </span>
          <span className="app-user-body">
            <strong>{name}</strong>
            <small>{session?.user ? headline : "Sign in to save a profile"}</small>
          </span>
        </Link>

        <nav aria-label="Workspace" className="app-nav">
          {LINKS.map((link) => (
            <Link
              className={`app-nav-link${active === link.key ? " is-active" : ""}`}
              href={link.href}
              key={link.key}
            >
              <span className="app-nav-label">{link.label}</span>
              <span className="app-nav-hint">{link.hint}</span>
              {counts[link.key] !== null ? <span className="app-nav-count">{counts[link.key]}</span> : null}
            </Link>
          ))}
        </nav>

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
            <p className="app-side-note">
              Signed in as <strong>{session.user.email}</strong>
            </p>
          ) : (
            <Link className="app-side-cta" href="/onboarding/resume?path=new-grad">
              Add your resume
            </Link>
          )}
          <p className="app-side-note">Nothing is submitted for you.</p>
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
        </header>
        {children}
      </div>
    </div>
  );
}
