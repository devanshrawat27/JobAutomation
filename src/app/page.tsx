import Link from "next/link";

import Reveal from "@/components/landing/reveal";
import Tilt from "@/components/landing/tilt";

const steps = [
  {
    number: "01",
    title: "Upload your resume",
    copy: "PDF or DOCX, read once. Every detail is proposed back with the exact line it came from — including scanned pages.",
  },
  {
    number: "02",
    title: "Confirm what is true",
    copy: "Keep, edit or skip each fact. That profile is the only thing every later step may use, and it is saved.",
  },
  {
    number: "03",
    title: "Apply with the evidence",
    copy: "See which jobs fit, get a resume, letter and form answers for each, then submit it yourself.",
  },
];

const icons = {
  trace: (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 16 16" width="16">
      <path d="M2.6 7.9 6 11.3l6.4-7" />
    </svg>
  ),
  filter: (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 16 16" width="16">
      <path d="M2.5 4h11M4.8 8h6.4M7 12h2" />
    </svg>
  ),
  india: (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 16 16" width="16">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.6V8l2.4 1.6" />
    </svg>
  ),
  community: (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 16 16" width="16">
      <circle cx="6" cy="5.6" r="2.2" />
      <path d="M1.9 13c0-2.1 1.8-3.4 4.1-3.4s4.1 1.3 4.1 3.4" />
      <path d="M11 4.1a2 2 0 0 1 0 3.9" />
    </svg>
  ),
};

const differentiators = [
  {
    icon: "trace" as const,
    title: "Every line cites a fact",
    copy: "A document line exists only because a confirmed fact sits under it. Unsupported claims are removed, not softened.",
  },
  {
    icon: "filter" as const,
    title: "A shortlist, not a feed",
    copy: "Postings are scored on named skills, your roles, the years asked, location and freshness — and only real matches are listed.",
  },
  {
    icon: "india" as const,
    title: "Built for Indian hiring",
    copy: "CGPA floors, batch years, degree cut-offs and notice periods are read from the posting and compared with your profile.",
  },
  {
    icon: "community" as const,
    title: "Community posts included",
    copy: "Founder and team posts from Hacker News and Mastodon, next to the employer's own boards — plus a one-click save when you are already reading a posting.",
  },
];

const faqs = [
  {
    q: "Does it apply for me?",
    a: "No. It prepares the resume, the letter and the form answers, and stops. You open the employer's form, check it and press submit. There is no auto-submit mode and no plan to add one.",
  },
  {
    q: "Where do the jobs come from?",
    a: "Employers' own public boards — Greenhouse, Lever, Ashby, SmartRecruiters and Workable — plus the Hacker News and Mastodon hiring threads. Nothing is scraped from LinkedIn or Naukri, which do not allow it.",
  },
  {
    q: "How fresh is the list?",
    a: "Nothing older than 14 days is kept. Every posting that ages out or disappears from its board is retired automatically.",
  },
  {
    q: "What happens when a posting asks something I never filled?",
    a: "It stays visibly blank. Notice period, visa sponsorship and salary are never guessed — you add them once on your profile and every later form reuses them.",
  },
  {
    q: "Why do some jobs show a warning?",
    a: "Postings that ask for a registration fee, promise daily earnings for data entry, or only offer a chat contact are flagged with the sentence that triggered it. Those are usually scams.",
  },
  {
    q: "Is my data shared with an employer?",
    a: "No. Your resume is read to propose facts and is not stored; the facts you confirm stay on your account and can be deleted at any time.",
  },
];

export default function Home() {
  return (
    <main className="lp2">
      <header className="lp2-header">
        <div className="lp2-header-inner">
          <Link aria-label="JobAutomation home" className="lp2-brand" href="/">
            <span aria-hidden="true" className="lp2-mark">
              <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="15">
                <rect height="7.4" rx="1.3" width="10.6" x="1.7" y="4.9" />
                <path d="M5.4 4.9V3.4a1 1 0 0 1 1-1h2.2a1 1 0 0 1 1 1v1.5" />
              </svg>
            </span>
            <span>jobautomation</span>
          </Link>

          <nav aria-label="Main navigation" className="lp2-nav">
            <a href="#demo">Product</a>
            <a href="#how">How it works</a>
            <a href="#questions">Questions</a>
          </nav>

          <div className="lp2-actions">
            <Link className="lp2-signin" href="/sign-in">Sign in</Link>
            <Link className="lp2-install" href="/onboarding">Get started</Link>
          </div>
        </div>
      </header>

      <section className="lp2-hero" aria-labelledby="hero-title">
        <p className="lp2-eyebrow lp2-in" style={{ "--d": "0ms" } as React.CSSProperties}>India-first · new grad and experienced</p>

        <h1 id="hero-title">
          <span className="lp2-line lp2-in" style={{ "--d": "90ms" } as React.CSSProperties}>Your resume in.</span>
          <span className="lp2-line is-muted lp2-in" style={{ "--d": "180ms" } as React.CSSProperties}>Right jobs out.</span>
        </h1>

        <p className="lp2-sub lp2-in" style={{ "--d": "280ms" } as React.CSSProperties}>
          A job-search workspace that reads your resume once, keeps a profile you confirmed, and prepares the resume, the
          letter and the form answers for each posting. You review everything. You press submit.
        </p>

        <div className="lp2-cta-row lp2-in" style={{ "--d": "380ms" } as React.CSSProperties}>
          <Link className="lp2-primary" href="/onboarding">
            Start with your resume <span aria-hidden="true">→</span>
          </Link>
          <Link className="lp2-ghost" href="#how">
            See how it works
          </Link>
        </div>

        <p className="lp2-fineprint lp2-in" style={{ "--d": "460ms" } as React.CSSProperties}>
          Free to start · no card · nothing is submitted for you
        </p>
      </section>

      <section aria-labelledby="demo-title" className="lp2-demo" id="demo">
        <h2 className="sr-only" id="demo-title">A look at the workspace</h2>
        <Tilt max={2}>
        <div className="lp2-shot">
          <div className="lp2-shot-bar">
            <span className="lp2-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="lp2-shot-url">localhost:3001/jobs</span>
          </div>
          <div className="lp2-shot-body">
            <aside className="lp2-shot-side" aria-hidden="true">
              <div className="lp2-shot-brand">
                <span className="lp2-shot-mark" />
                <span>jobautomation</span>
              </div>

              <div className="lp2-shot-user">
                <span className="lp2-shot-avatar">DR</span>
                <span className="lp2-shot-user-body">
                  <strong>Devansh Rawat</strong>
                  <small>Student · class of 2027</small>
                </span>
              </div>

              <div className="lp2-shot-nav">
                <span>Profile <b>24</b></span>
                <span className="is-active">Jobs <b>1,293</b></span>
                <span>Documents <b>3</b></span>
                <span>Applications <b>2</b></span>
                <span>Digest</span>
              </div>

              <div className="lp2-shot-meter">
                <small>Profile · 5 of 5 areas</small>
                <span className="lp2-shot-track"><i /></span>
              </div>
            </aside>
            <div className="lp2-shot-main" aria-hidden="true">
              <div className="lp2-shot-head">
                <div>
                  <small>For you</small>
                  <strong>Shortlisted roles</strong>
                </div>
                <span className="lp2-pill">scanned 2 min ago</span>
              </div>
              <div className="lp2-shot-filters">
                <span className="is-on">All roles</span>
                <span>Fresher</span>
                <span>Remote</span>
                <span>Last 14 days</span>
              </div>
              {[
                ["Software Development Engineer Intern", "HackerRank · Bengaluru", "82", "strong"],
                ["AI Engineer Apprentice", "StartupHakk · Remote", "78", "strong"],
                ["Software Engineer, New Grad", "Stripe · Bengaluru", "70", "good"],
              ].map(([title, meta, score, tone]) => (
                <div className="lp2-shot-card" key={title}>
                  <div>
                    <strong>{title}</strong>
                    <small>{meta}</small>
                  </div>
                  <span className={`lp2-score is-${tone}`}>{score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </Tilt>
        <p className="lp2-fineprint">Illustrative workspace — figures are sample data.</p>
      </section>

      <Reveal as="section" className="lp2-section" id="how">
        <p className="lp2-kicker">How it works</p>
        <h2 id="how-title">
          <span>Once from you.</span>
          <span className="is-muted">Every application after that.</span>
        </h2>
        <div className="lp2-steps">
          {steps.map((step) => (
            <article className="lp2-step" key={step.number}>
              <span className="lp2-step-num" aria-hidden="true">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" className="lp2-section">
        <p className="lp2-kicker">Why it is different</p>
        <h2 id="why-title">
          <span>Facts you can trace.</span>
          <span className="is-muted">Nothing invented.</span>
        </h2>
        <div className="lp2-grid">
          {differentiators.map((item) => (
            <article className="lp2-card" key={item.title}>
              <span aria-hidden="true" className="lp2-card-icon">{icons[item.icon]}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" className="lp2-section lp2-faq" id="questions">
        <p className="lp2-kicker">Questions</p>
        <h2 id="questions-title">
          <span>Questions,</span>
          <span className="is-muted">answered plainly.</span>
        </h2>
        <div className="lp2-faq-list">
          {faqs.map((faq) => (
            <details className="lp2-faq-item" key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </Reveal>

      <Reveal className="lp2-closing">
        <p className="lp2-kicker">Start here</p>
        <h2 id="closing-title">
          <span>Fewer applications.</span>
          <span className="is-muted">Better evidence.</span>
        </h2>
        <p>Start from the resume you already have. Two minutes to a saved profile.</p>
        <Link className="lp2-primary" href="/onboarding">
          Get started free <span aria-hidden="true">→</span>
        </Link>
      </Reveal>

      <footer className="lp2-footer">
        <Link className="lp2-brand" href="/">
          <span aria-hidden="true" className="lp2-mark">
            <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="15">
              <rect height="7.4" rx="1.3" width="10.6" x="1.7" y="4.9" />
              <path d="M5.4 4.9V3.4a1 1 0 0 1 1-1h2.2a1 1 0 0 1 1 1v1.5" />
            </svg>
          </span>
          <span>jobautomation</span>
        </Link>
        <p>You review every document. The submit button stays yours.</p>
        <div className="lp2-footer-links">
          <Link href="/jobs">Browse jobs</Link>
          <Link href="/sign-in">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}
