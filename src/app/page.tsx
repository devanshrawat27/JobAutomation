import Link from "next/link";
import type { ReactNode } from "react";

import Aurora from "@/components/premium/aurora";
import Reveal from "@/components/premium/reveal";
import Tilt from "@/components/premium/tilt";

type IconName =
  | "search"
  | "briefcase"
  | "users"
  | "bolt"
  | "check"
  | "shield"
  | "spark"
  | "file"
  | "clock"
  | "target"
  | "grid"
  | "compass"
  | "inbox"
  | "user"
  | "settings";

const paths: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="6.4" cy="6.4" r="4.1" />
      <path d="M9.6 9.6 13 13" />
    </>
  ),
  briefcase: (
    <>
      <rect height="7.4" rx="1.3" width="10.6" x="1.7" y="4.9" />
      <path d="M5.4 4.9V3.4a1 1 0 0 1 1-1h2.2a1 1 0 0 1 1 1v1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="6" cy="5.6" r="2.2" />
      <path d="M1.9 13c0-2.1 1.8-3.4 4.1-3.4s4.1 1.3 4.1 3.4" />
      <path d="M11 4.1a2 2 0 0 1 0 3.9M12.1 9.9c1.3.5 2.1 1.5 2.1 3.1" />
    </>
  ),
  bolt: <path d="M8.6 1.7 3.4 8.2h3.3l-1.3 5.1 5.2-6.5H7.3z" />,
  check: <path d="M2.6 7.9 6 11.3l6.4-7" />,
  shield: <path d="M8 1.9 3 3.9v4.2c0 3 2.1 4.9 5 6 2.9-1.1 5-3 5-6V3.9z" />,
  spark: (
    <>
      <path d="M8 1.8v3.1M8 11.1v3.1M1.8 8h3.1M11.1 8h3.1" />
      <path d="m3.7 3.7 2.1 2.1M10.2 10.2l2.1 2.1M12.3 3.7l-2.1 2.1M5.8 10.2l-2.1 2.1" />
    </>
  ),
  file: (
    <>
      <path d="M4 1.8h5l3 3v9.4H4z" />
      <path d="M9 1.8v3h3" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.6V8l2.4 1.6" />
    </>
  ),
  target: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.4" />
    </>
  ),
  grid: (
    <>
      <rect height="4.4" rx="1" width="4.4" x="1.8" y="1.8" />
      <rect height="4.4" rx="1" width="4.4" x="9.8" y="1.8" />
      <rect height="4.4" rx="1" width="4.4" x="1.8" y="9.8" />
      <rect height="4.4" rx="1" width="4.4" x="9.8" y="9.8" />
    </>
  ),
  compass: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="m10.2 5.8-1.5 3.2-3.2 1.5 1.5-3.2z" />
    </>
  ),
  inbox: (
    <>
      <path d="M1.8 9.2 4 3.2h8l2.2 6v3.6H1.8z" />
      <path d="M1.8 9.2h3.5l.7 1.6h4l.7-1.6h3.5" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="5.6" r="2.6" />
      <path d="M3.1 13.6c0-2.6 2.2-4.2 4.9-4.2s4.9 1.6 4.9 4.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.9v1.7M8 12.4v1.7M1.9 8h1.7M12.4 8h1.7M4 4l1.2 1.2M10.8 10.8 12 12M12 4l-1.2 1.2M5.2 10.8 4 12" />
    </>
  ),
};

function Icon({ name, size = 13 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 16 16"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}

const steps = [
  {
    title: "Upload your resume",
    copy: "PDF or DOCX, read once. We propose the facts we find and show the exact line each one came from. Nothing is added that is not in your file.",
  },
  {
    title: "Confirm what is true",
    copy: "Keep, edit or skip each detail. That reviewed profile is the only thing later steps may use — it is saved, so you never upload the same resume again.",
  },
  {
    title: "See which jobs actually fit",
    copy: "Open a posting and read it requirement by requirement: what your profile answers, what is a gap, and the quote from both sides.",
  },
  {
    title: "Prepare, then apply",
    copy: "Get a tailored resume, a cover letter and the form answers for that job. Download them, fill the employer's form, and submit it yourself.",
  },
];

const benefits = [
  {
    icon: "target" as IconName,
    title: "One profile, saved once",
    copy: "Upload a resume a single time. Edit any detail on your profile whenever you want — no re-upload.",
  },
  {
    icon: "search" as IconName,
    title: "Jobs matched to you",
    copy: "Open roles from public employer boards, filtered by the skills and titles you confirmed.",
  },
  {
    icon: "file" as IconName,
    title: "Resume and letter per job",
    copy: "Written from your own facts, checked line by line. Anything unsupported is removed, not softened.",
  },
  {
    icon: "inbox" as IconName,
    title: "Form answers ready to copy",
    copy: "Name, email, phone, notice period and more, with a note when something still needs you.",
  },
];

const limits = [
  { title: "No auto-apply", copy: "Nothing is submitted in your name. You review and press submit." },
  { title: "No invented facts", copy: "Every generated line cites a fact you confirmed, or it is deleted." },
  { title: "No scraping around the rules", copy: "Jobs come from public employer boards. No CAPTCHAs or logins bypassed." },
];

const audiences = [
  { icon: "spark" as IconName, title: "Students & new grads", copy: "Internships and first roles, built around your projects and coursework." },
  { icon: "briefcase" as IconName, title: "Experienced professionals", copy: "Senior roles matched to the experience your resume can prove." },
  { icon: "compass" as IconName, title: "Career switchers", copy: "Your existing work described in the words of the field you want." },
];

const feed = [
  { text: "New roles matched to your profile", time: "5 min ago" },
  { text: "Cover letter drafted for a saved role", time: "12 min ago" },
  { text: "Application ready for your review", time: "18 min ago" },
  { text: "Posting checked against your profile", time: "1 hour ago" },
];

const matches = [
  { initials: "NW", role: "Software Engineer Intern", meta: "Bengaluru · Internship", pill: "Strong fit" },
  { initials: "AL", role: "Full Stack Developer", meta: "Remote · Full-time", pill: "Good fit" },
  { initials: "BR", role: "Backend Engineer", meta: "Bengaluru · Full-time", pill: "Good fit" },
];

export default function Home() {
  return (
    <main className="ld">
      <div className="ld-wrap">
        <header className="ld-header">
          <Link className="ld-brand" href="/">
            <span aria-hidden="true" className="ld-brand-mark">
              <Icon name="briefcase" size={14} />
            </span>
            <span>jobautomation</span>
          </Link>
          <nav aria-label="Main navigation" className="ld-nav">
            <a href="#how">How it works</a>
            <a href="#benefits">What you get</a>
            <a href="#limits">Limits</a>
            <a href="#who">Who it’s for</a>
          </nav>
          <div className="ld-header-actions">
            <Link className="ld-signin" href="/sign-in">
              Sign in
            </Link>
            <Link className="ld-cta" href="/onboarding">
              Get started <span aria-hidden="true">→</span>
            </Link>
          </div>
        </header>

        <section aria-labelledby="hero-title" className="ld-hero">
          <Aurora />
          <div className="ld-hero-copy-col">
            <p className="ld-eyebrow">
              <b>India-first</b>
              <i aria-hidden="true" />
              For students, freshers and experienced professionals
            </p>
            <h1 id="hero-title">
              Your resume in.
              <br />
              Right jobs out.
              <br />
              <em>Nothing invented.</em>
            </h1>
            <p className="ld-hero-copy">
              Upload your resume once. Confirm what is true, see which jobs really fit, and get a resume, cover letter and
              form answers for each one — all from facts you approved.
            </p>
            <div className="ld-hero-actions">
              <Link className="ld-cta" href="/onboarding">
                Start free with your resume <span aria-hidden="true">→</span>
              </Link>
              <Link className="ld-cta ld-cta--ghost" href="#how">
                See how it works
              </Link>
            </div>
            <ul className="ld-trust">
              <li>
                <Icon name="bolt" size={13} /> Free to get started
              </li>
              <li>
                <Icon name="shield" size={13} /> No card required
              </li>
              <li>
                <Icon name="check" size={13} /> You submit, never a bot
              </li>
            </ul>
          </div>

          <Tilt className="hero-stage">
          <div className="ld-preview" aria-label="Illustrative product view" role="img">
            <div className="ld-preview-bar">
              <span className="ld-preview-search">
                <Icon name="search" size={11} />
                Search jobs, companies or keywords…
                <kbd>⌘K</kbd>
              </span>
              <span className="ld-preview-avatar">DR</span>
            </div>

            <div className="ld-preview-body">
              <aside className="ld-preview-side">
                <div className="ld-preview-brand">
                  <i aria-hidden="true">j</i> jobautomation
                </div>
                <ul>
                  <li className="is-active">
                    <Icon name="grid" size={11} /> Overview
                  </li>
                  <li>
                    <Icon name="search" size={11} /> Discover jobs
                  </li>
                  <li>
                    <Icon name="inbox" size={11} /> Applications
                  </li>
                  <li>
                    <Icon name="users" size={11} /> Referral copilot
                  </li>
                  <li>
                    <Icon name="file" size={11} /> Documents
                  </li>
                  <li>
                    <Icon name="user" size={11} /> My profile
                  </li>
                  <li>
                    <Icon name="settings" size={11} /> Settings
                  </li>
                </ul>
              </aside>

              <div className="ld-preview-main">
                <div className="ld-preview-greet">
                  <strong>Good morning.</strong>
                  <span>Here is where your search stands today.</span>
                </div>

                <div className="ld-preview-stats">
                  <div className="ld-stat">
                    <Icon name="search" size={12} />
                    <strong>128</strong>
                    <small>Jobs matched</small>
                  </div>
                  <div className="ld-stat">
                    <Icon name="inbox" size={12} />
                    <strong>24</strong>
                    <small>Applications</small>
                  </div>
                  <div className="ld-stat">
                    <Icon name="users" size={12} />
                    <strong>19</strong>
                    <small>Referral leads</small>
                  </div>
                  <div className="ld-stat">
                    <Icon name="clock" size={12} />
                    <strong>5</strong>
                    <small>Follow-ups</small>
                  </div>
                </div>

                <div className="ld-preview-cols">
                  <div className="ld-panel">
                    <div className="ld-panel-head">
                      Recent activity <span>this week</span>
                    </div>
                    <ul className="ld-feed">
                      {feed.map((item) => (
                        <li key={item.text}>
                          <i aria-hidden="true" />
                          <b>{item.text}</b>
                          <small>{item.time}</small>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="ld-panel">
                    <div className="ld-panel-head">
                      Top matches <span>view all</span>
                    </div>
                    <ul className="ld-matches">
                      {matches.map((match) => (
                        <li className="ld-match" key={match.role}>
                          <span className="ld-match-logo">{match.initials}</span>
                          <span>
                            <b>{match.role}</b>
                            <small>{match.meta}</small>
                          </span>
                          <span className="ld-match-pill">{match.pill}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="ld-preview-note">Illustrative product view — figures are sample data.</p>
              </div>
            </div>
          </div>
          <div aria-hidden="true" className="float-chip float-chip--a">
            <span className="float-chip-dot" /> Strong fit · 92%
          </div>
          <div aria-hidden="true" className="float-chip float-chip--b">
            Cover letter drafted
          </div>
          </Tilt>
        </section>

        <section aria-label="The four steps" className="ld-strip" id="how">
          <p className="ld-strip-label">Four steps, in this order</p>
          <div className="ld-strip-steps">
            <span className="ld-chip">
              <i aria-hidden="true">
                <Icon name="file" size={11} />
              </i>
              Upload resume
            </span>
            <span aria-hidden="true" className="ld-strip-arrow">
              →
            </span>
            <span className="ld-chip">
              <i aria-hidden="true">
                <Icon name="check" size={11} />
              </i>
              Confirm your profile
            </span>
            <span aria-hidden="true" className="ld-strip-arrow">
              →
            </span>
            <span className="ld-chip">
              <i aria-hidden="true">
                <Icon name="target" size={11} />
              </i>
              Find jobs that fit
            </span>
            <span aria-hidden="true" className="ld-strip-arrow">
              →
            </span>
            <span className="ld-chip">
              <i aria-hidden="true">
                <Icon name="inbox" size={11} />
              </i>
              Prepare and apply
            </span>
          </div>
        </section>

        <section aria-labelledby="steps-title" className="ld-section" id="how-detailed">
          <Reveal className="ld-section-head ld-section-head--row">
            <h2 id="steps-title">
              How it works,
              <br />
              <em>step by step.</em>
            </h2>
            <p className="ld-section-note">
              No course to finish and nothing to learn. Four screens: your resume, your profile, a job, an application.
            </p>
          </Reveal>

          <ol className="ld-flow ld-flow--wide">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="ld-flow-num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <b>{step.title}</b>
                  <p>{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="benefits-title" className="ld-section" id="benefits">
          <Reveal className="ld-section-head ld-section-head--row">
            <h2 id="benefits-title">
              What you get
              <br />
              <em>on every job.</em>
            </h2>
            <p className="ld-section-note">
              The same four things, every time you open a posting. No guessing what the product is for.
            </p>
          </Reveal>

          <Reveal className="ld-features">
            {benefits.map((feature) => (
              <article className="ld-feature" key={feature.title}>
                <span className="ld-feature-icon">
                  <Icon name={feature.icon} size={15} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </Reveal>
        </section>
      </div>

      <section aria-labelledby="workflow-title" className="ld-band" id="workflow">
        <div className="ld-wrap ld-band-grid">
          <div className="ld-band-copy">
            <h2 id="workflow-title">
              What a job page
              <br />
              <em>looks like.</em>
            </h2>
            <p>Open any posting and you see two things: how your profile answers it, and what you can send today.</p>
            <ol className="ld-flow">
              <li>
                <span className="ld-flow-num" aria-hidden="true">01</span>
                <div>
                  <b>Requirements, quoted</b>
                  <p>Each line of the posting is marked supported, partial or a gap.</p>
                </div>
              </li>
              <li>
                <span className="ld-flow-num" aria-hidden="true">02</span>
                <div>
                  <b>Your evidence beside it</b>
                  <p>The fact that answers it, with the line it came from.</p>
                </div>
              </li>
              <li>
                <span className="ld-flow-num" aria-hidden="true">03</span>
                <div>
                  <b>Documents ready to download</b>
                  <p>A resume and cover letter for this role, as PDFs.</p>
                </div>
              </li>
              <li>
                <span className="ld-flow-num" aria-hidden="true">04</span>
                <div>
                  <b>Form answers ready to copy</b>
                  <p>With a clear note when a field still needs your input.</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="ld-mocks">
            <div aria-hidden="true" className="ld-mock">
              <div className="ld-mock-head">
                Role fit
                <span className="ld-mock-status">
                  <i /> evidence based
                </span>
              </div>
              <div className="ld-mock-body">
                <div className="ld-mock-job">
                  <i>NW</i>
                  <span>
                    <b>Software Engineer Intern</b>
                    <small>Bengaluru · Internship</small>
                  </span>
                  <span className="ld-match-pill">Strong fit</span>
                </div>
                <div className="ld-mock-tabs">
                  <b>Job fit</b>
                  <span>Requirements</span>
                  <span>My match</span>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 8.5, fontWeight: 650 }}>Why you’re a strong fit</p>
                <ul className="ld-mock-list">
                  <li>
                    <Icon name="check" size={9} /> Your projects answer the Python requirement
                  </li>
                  <li>
                    <Icon name="check" size={9} /> Experience computed from your dated roles
                  </li>
                  <li>
                    <Icon name="check" size={9} /> Skills match the posting’s stack
                  </li>
                </ul>
                <div className="ld-mock-doc">
                  <Icon name="file" size={11} />
                  <span>
                    <b>Resume_v1.pdf</b>
                    <small>PDF · tailored from confirmed facts</small>
                  </span>
                  <em>View</em>
                </div>
                <div className="ld-mock-doc">
                  <Icon name="file" size={11} />
                  <span>
                    <b>Cover_letter.pdf</b>
                    <small>PDF · cites 6 profile facts</small>
                  </span>
                  <em>View</em>
                </div>
              </div>
            </div>

            <div aria-hidden="true" className="ld-mock">
              <div className="ld-mock-head">
                Form answers
                <span className="ld-mock-status">
                  <i /> ready
                </span>
              </div>
              <div className="ld-mock-body">
                <div className="ld-mock-field">
                  <span>Full name</span>
                  <b>From profile</b>
                  <Icon name="check" size={9} />
                </div>
                <div className="ld-mock-field">
                  <span>Email</span>
                  <b>From profile</b>
                  <Icon name="check" size={9} />
                </div>
                <div className="ld-mock-field">
                  <span>Phone number</span>
                  <b>From profile</b>
                  <Icon name="check" size={9} />
                </div>
                <div className="ld-mock-field">
                  <span>Current location</span>
                  <b>From profile</b>
                  <Icon name="check" size={9} />
                </div>
                <div className="ld-mock-field">
                  <span>Notice period</span>
                  <b>Needs you</b>
                </div>
                <div className="ld-mock-submit">You review and submit</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="ld-wrap">
        <section aria-labelledby="limits-title" className="ld-section" id="limits">
          <Reveal className="ld-section-head ld-section-head--row">
            <h2 id="limits-title">
              What it will
              <br />
              <em>never do.</em>
            </h2>
            <p className="ld-section-note">
              These are promises, not settings. If you want applications sent for you, this is the wrong product.
            </p>
          </Reveal>
          <Reveal className="ld-limits-grid">
            {limits.map((limit) => (
              <article className="ld-limit" key={limit.title}>
                <span aria-hidden="true" className="ld-limit-mark">
                  —
                </span>
                <h3>{limit.title}</h3>
                <p>{limit.copy}</p>
              </article>
            ))}
          </Reveal>
        </section>

        <section aria-labelledby="who-title" className="ld-section ld-audience" id="who">
          <div className="ld-audience-copy">
            <h2 id="who-title">
              Built for <em>Indian</em>
              <br />
              job seekers.
            </h2>
            <p>
              Whether you are in college, a recent graduate, or already working, the profile and the evidence are the same
              idea — only the questions change.
            </p>
          </div>
          <Reveal className="ld-audience-cards">
            {audiences.map((card) => (
              <article className="ld-audience-card" key={card.title}>
                <i aria-hidden="true">
                  <Icon name={card.icon} size={13} />
                </i>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </Reveal>
        </section>

        <section aria-labelledby="closing-title" className="ld-closing">
          <h2 id="closing-title">Start with the resume you already have.</h2>
          <p>Two minutes to a saved profile. Then see the first jobs that actually fit it.</p>
          <Link className="ld-cta ld-cta--blue" href="/onboarding">
            Get started free <span aria-hidden="true">→</span>
          </Link>
        </section>

        <footer className="ld-footer">
          <Link className="ld-brand" href="/">
            <span aria-hidden="true" className="ld-brand-mark">
              <Icon name="briefcase" size={14} />
            </span>
            <span>jobautomation</span>
          </Link>
          <p>You review every document. The submit button stays yours.</p>
          <div className="ld-footer-links">
            <Link href="/jobs">Browse jobs</Link>
            <Link href="/sign-in">Sign in</Link>
            <a href="#how">How it works</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
