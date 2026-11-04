"use client";

import Link from "next/link";
import { useState } from "react";

import { savePreferences } from "@/app/actions/preferences";

type Initial = {
  roles: string;
  topSkills: string;
  years: string;
  locations: string;
  remote: boolean;
  currentCtc: string;
  fresher: boolean;
  expectedCtc: string;
  mode: string;
  relocate: string;
  availability: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  gender: string;
  disability: string;
  exclude: string;
};

type Props = {
  initial: Initial;
  knownSkills: string[];
  suggestedRoles: string[];
  suggestedCity: string;
  hasResume: boolean;
};

const CITIES = [
  "Bengaluru",
  "Delhi NCR",
  "Gurugram",
  "Noida",
  "Delhi",
  "Mumbai",
  "Pune",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
];

const MODES = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote only" },
];

const RELOCATE = [
  { value: "yes", label: "Yes, for the right role" },
  { value: "no", label: "No, keep me local" },
];

const AVAILABILITY = [
  "Ready to join immediately",
  "15 days",
  "1 month",
  "More than 1 month",
  "Currently not working",
];

const GENDERS = ["Woman", "Man", "Non-binary", "Prefer not to say"];
const DISABILITY = ["Yes", "No", "Prefer not to say"];

const STEPS = [
  { n: 3, kicker: "Target roles", title: "What roles should we apply for?", line: "a place to aim at." },
  { n: 4, kicker: "Skills", title: "What are you great at?", line: "the work you can prove." },
  { n: 5, kicker: "Where", title: "Which cities should we search in?", line: "where the week happens." },
  { n: 6, kicker: "Compensation", title: "Let's talk numbers.", line: "the number, stated plainly." },
  { n: 7, kicker: "How you work", title: "How do you want to work?", line: "the shape of your days." },
  { n: 8, kicker: "Last details", title: "A few last details.", line: "the last few blanks." },
] as const;

function split(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function toggle(list: string[], value: string, max: number): string[] {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (list.length >= max) return list;
  return [...list, value];
}

export default function PreferencesWizard({ initial, knownSkills, suggestedRoles, suggestedCity, hasResume }: Props) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState(false);
  const [draft, setDraft] = useState("");
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [v, setV] = useState({
    roles: split(initial.roles),
    skills: split(initial.topSkills),
    years: initial.years,
    cities: split(initial.locations).filter((city) => !/^remote$/i.test(city)),
    remote: initial.remote,
    currentCtc: initial.currentCtc,
    fresher: initial.fresher,
    expectedCtc: initial.expectedCtc,
    mode: initial.mode,
    relocate: initial.relocate,
    availability: initial.availability,
    phone: initial.phone,
    linkedin: initial.linkedin,
    github: initial.github,
    portfolio: initial.portfolio,
    sameAsGithub: Boolean(initial.github) && initial.github === initial.portfolio,
    gender: initial.gender,
    disability: initial.disability,
    exclude: initial.exclude,
  });

  const patch = (next: Partial<typeof v>) => setV((prev) => ({ ...prev, ...next }));
  const toggleIn = (key: "roles" | "skills" | "cities", value: string, max: number) =>
    setV((prev) => ({ ...prev, [key]: toggle(prev[key], value, max) }));
  const cities = [...new Set([suggestedCity, ...CITIES])];
  const roleChoices = [...new Set([...suggestedRoles, ...v.roles])];
  const skillChoices = [
    ...new Set([...v.skills, ...knownSkills, "TypeScript", "Python", "React.js", "Node.js", "SQL"]),
  ].slice(0, 30);
  const visibleSkills = showAllSkills ? skillChoices : skillChoices.slice(0, 15);

  const current = STEPS[step];
  const number = brief ? "08" : String(current.n).padStart(2, "0");
  const kicker = brief ? "Your brief" : current.kicker;
  const line = brief ? "here's who you are." : current.line;

  function addDraft(target: "roles" | "skills" | "cities") {
    const value = draft.trim();
    if (!value) return;
    if (target === "roles") toggleIn("roles", value, 3);
    if (target === "skills") toggleIn("skills", value, 5);
    if (target === "cities") toggleIn("cities", value, 8);
    setDraft("");
  }

  function complete(): boolean {
    if (brief) return true;
    switch (step) {
      case 0:
        return v.roles.length > 0;
      case 1:
        return v.skills.length > 0 && v.years.trim() !== "";
      case 2:
        return v.cities.length > 0 || v.remote;
      case 3:
        return Number(v.expectedCtc) > 0;
      case 4:
        return Boolean(v.mode) && Boolean(v.relocate) && Boolean(v.availability);
      case 5:
        return true;
      default:
        return false;
    }
  }

  function next() {
    if (!complete()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else setBrief(true);
  }

  const yearNumber = Number(v.years);
  const yearsLabel = Number.isFinite(yearNumber) && v.years !== ""
    ? `${yearNumber} ${yearNumber === 1 ? "year" : "years"}`
    : "not stated";

  return (
    <form action={savePreferences} className="wiz-shell">
      <input name="roles" type="hidden" value={v.roles.join(", ")} />
      <input name="topSkills" type="hidden" value={v.skills.join(", ")} />
      <input name="years" type="hidden" value={v.years} />
      <input name="locations" type="hidden" value={v.cities.join(", ")} />
      <input name="remote" type="hidden" value={v.remote ? "1" : ""} />
      <input name="currentCtc" type="hidden" value={v.fresher ? "0" : v.currentCtc} />
      <input name="expectedCtc" type="hidden" value={v.expectedCtc} />
      <input name="mode" type="hidden" value={v.mode} />
      <input name="relocate" type="hidden" value={v.relocate} />
      <input name="availability" type="hidden" value={v.availability} />
      <input name="phone" type="hidden" value={v.phone} />
      <input name="linkedin" type="hidden" value={v.linkedin} />
      <input name="github" type="hidden" value={v.github} />
      <input name="portfolio" type="hidden" value={v.sameAsGithub ? v.github : v.portfolio} />
      <input name="gender" type="hidden" value={v.gender} />
      <input name="disability" type="hidden" value={v.disability} />
      <input name="exclude" type="hidden" value={v.exclude} />

      <aside className="wiz-aside" aria-hidden="true">
        <span className="wiz-aside-glyph">{number}</span>
        <div className="wiz-aside-top">
          <p className="wiz-aside-kicker">{kicker}</p>
          <p className="wiz-aside-line">{line}</p>
        </div>

        <div className="wiz-aside-foot">
          <ol className="wiz-track">
            {STEPS.map((item, index) => {
              const state = brief || index < step ? "is-done" : index === step ? "is-now" : "";
              return (
                <li className={state} key={item.n}>
                  <span className="wiz-track-num">{String(item.n).padStart(2, "0")}</span>
                  <span className="wiz-track-label">{item.kicker}</span>
                </li>
              );
            })}
          </ol>
          <div className="wiz-track-bar">
            <i style={{ width: `${((brief ? 6 : step + 1) / 6) * 100}%` }} />
          </div>
          <p className="wiz-aside-note">
            {brief ? "Review, then save" : `${6 - step} short step${6 - step === 1 ? "" : "s"} left · about a minute each`}
          </p>
        </div>
      </aside>

      <section aria-labelledby="wiz-title" className="wiz-main">
        <p className="wiz-main-kicker">
          {brief ? "Before your first match" : `Step ${current.n} of 8`}
        </p>

        {brief ? (
          <div className="wiz-brief">
            <h1 id="wiz-title">Here&rsquo;s my brief on you.</h1>
            <p className="onboarding-intro">
              This is what the matcher will work from — every line came from something you confirmed. Nothing is shared
              with an employer until you send an application yourself.
            </p>

            <dl className="wiz-brief-rows">
              <div>
                <dt>Is</dt>
                <dd>
                  {v.roles.length > 0 ? `Targeting ${v.roles.join(" · ")}` : "No target role stated"}
                  {v.years !== "" ? `, with ${yearsLabel} of experience` : ""}
                </dd>
              </div>
              <div>
                <dt>Knows</dt>
                <dd>{v.skills.length > 0 ? v.skills.join(" · ") : "No top skills picked"}</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>
                  {[
                    v.cities.length > 0 ? `${v.cities.join(", ")}${v.remote ? " or remote" : ""}` : v.remote ? "Remote" : "",
                    MODES.find((mode) => mode.value === v.mode)?.label ?? "",
                    v.relocate === "yes" ? "open to relocating" : "",
                    v.availability,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
              <div>
                <dt>Pay</dt>
                <dd>
                  {v.expectedCtc ? `₹${v.expectedCtc} LPA expected` : "No expectation stated"}
                  {v.currentCtc && !v.fresher ? ` · ₹${v.currentCtc} LPA now` : v.fresher ? " · fresher" : ""}
                </dd>
              </div>
              {v.exclude ? (
                <div>
                  <dt>Never</dt>
                  <dd>{v.exclude}</dd>
                </div>
              ) : null}
            </dl>

            <p className="wiz-fineprint">
              These answers live on your account like any other confirmed fact. We never ask for an ATS board password,
              and we do not sign in as you.
            </p>
          </div>
        ) : (
          <>
            <h1 id="wiz-title">{current.title}</h1>

            {step === 0 ? (
              <>
                <p className="onboarding-intro">
                  Pick up to three titles — the ones you would take tomorrow. They join the title signal in every score,
                  alongside the roles on your resume{hasResume ? "" : " once you add one"}.
                </p>
                <div className="wiz-chips">
                  {roleChoices.map((role) => (
                    <button
                      aria-pressed={v.roles.includes(role)}
                      className={`wiz-chip${v.roles.includes(role) ? " is-on" : ""}`}
                      key={role}
                      onClick={() => toggleIn("roles", role, 3)}
                      type="button"
                    >
                      <span className="wiz-chip-mark" aria-hidden="true">{v.roles.includes(role) ? "✓" : "+"}</span>
                      {role}
                    </button>
                  ))}
                </div>
                <div className="wiz-add">
                  <input
                    aria-label="Add a role"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addDraft("roles");
                      }
                    }}
                    placeholder="Add your own title"
                    value={draft}
                  />
                  <button className="wiz-add-button" onClick={() => addDraft("roles")} type="button">Add</button>
                </div>
                <p className="wiz-meter">{v.roles.length} of 3 picked</p>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <p className="onboarding-intro">
                  Choose up to five — the ones a recruiter should see first. They carry more weight than skills mentioned
                  further down your profile.
                </p>
                <div className="wiz-chips">
                  {visibleSkills.map((skill) => (
                    <button
                      aria-pressed={v.skills.includes(skill)}
                      className={`wiz-chip${v.skills.includes(skill) ? " is-on" : ""}`}
                      key={skill}
                      onClick={() => toggleIn("skills", skill, 5)}
                      type="button"
                    >
                      <span className="wiz-chip-mark" aria-hidden="true">{v.skills.includes(skill) ? "✓" : "+"}</span>
                      {skill}
                    </button>
                  ))}
                  {!showAllSkills && skillChoices.length > visibleSkills.length ? (
                    <button
                      className="wiz-chip is-more"
                      onClick={() => setShowAllSkills(true)}
                      type="button"
                    >
                      +{skillChoices.length - visibleSkills.length} more
                    </button>
                  ) : null}
                </div>
                <div className="wiz-add">
                  <input
                    aria-label="Add a skill"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addDraft("skills");
                      }
                    }}
                    placeholder="Add a skill"
                    value={draft}
                  />
                  <button className="wiz-add-button" onClick={() => addDraft("skills")} type="button">Add</button>
                </div>
                <p className="wiz-meter">{v.skills.length} of 5 picked</p>

                <label className="wiz-years">
                  <span>Total years of experience</span>
                  <span className="wiz-years-input">
                    <input
                      inputMode="decimal"
                      min={0}
                      onChange={(event) => patch({ years: event.target.value })}
                      step="0.5"
                      type="number"
                      value={v.years}
                    />
                    <em>years</em>
                  </span>
                </label>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="onboarding-intro">
                  Pick at least one city, or switch on remote. These decide which postings are reachable — not just which
                  forms get filled.
                </p>
                <div className="wiz-chips">
                  {cities.map((city) => (
                    <button
                      aria-pressed={v.cities.includes(city)}
                      className={`wiz-chip${v.cities.includes(city) ? " is-on" : ""}`}
                      key={city}
                      onClick={() => toggleIn("cities", city, 8)}
                      type="button"
                    >
                      <span className="wiz-chip-mark" aria-hidden="true">{v.cities.includes(city) ? "✓" : "+"}</span>
                      {city}
                    </button>
                  ))}
                </div>
                <button
                  aria-pressed={v.remote}
                  className={`wiz-toggle${v.remote ? " is-on" : ""}`}
                  onClick={() => patch({ remote: !v.remote })}
                  type="button"
                >
                  <span>
                    <strong>Open to remote</strong>
                    <small>Include remote roles from anywhere you can work.</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
                <div className="wiz-add">
                  <input
                    aria-label="Add a city"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addDraft("cities");
                      }
                    }}
                    placeholder="Add a city"
                    value={draft}
                  />
                  <button className="wiz-add-button" onClick={() => addDraft("cities")} type="button">Add</button>
                </div>
                <p className="wiz-meter">{v.cities.length} {v.cities.length === 1 ? "city" : "cities"} picked</p>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <p className="onboarding-intro">
                  We ask so postings that state less than you need are filtered out of your feed — not ranked and then
                  ignored.
                </p>
                <div className="wiz-money">
                  <label>
                    <span>Current CTC</span>
                    <span className="wiz-money-input">
                      <em>₹</em>
                      <input
                        disabled={v.fresher}
                        inputMode="decimal"
                        onChange={(event) => patch({ currentCtc: event.target.value })}
                        placeholder="18"
                        type="text"
                        value={v.fresher ? "0" : v.currentCtc}
                      />
                      <em>LPA</em>
                    </span>
                  </label>
                  <button
                    aria-pressed={v.fresher}
                    className={`wiz-chip${v.fresher ? " is-on" : ""}`}
                    onClick={() => patch({ fresher: !v.fresher, currentCtc: v.fresher ? "" : "0" })}
                    type="button"
                  >
                    <span className="wiz-chip-mark" aria-hidden="true">{v.fresher ? "✓" : ""}</span>
                    I&rsquo;m a fresher
                  </button>
                </div>
                <label className="wiz-money is-single">
                  <span>Expected CTC</span>
                  <span className="wiz-money-input">
                    <em>₹</em>
                    <input
                      inputMode="decimal"
                      onChange={(event) => patch({ expectedCtc: event.target.value })}
                      placeholder="12"
                      type="text"
                      value={v.expectedCtc}
                    />
                    <em>LPA</em>
                  </span>
                </label>
                <details className="wiz-note">
                  <summary>Why we ask this</summary>
                  <p>
                    Your expectation is a floor for the feed: postings that state pay below it are hidden from
                    &ldquo;For you&rdquo;, not used to negotiate anything. It is never shown to an employer.
                  </p>
                </details>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <p className="onboarding-intro">
                  This shapes the matches we send you, not just the forms we fill. All three answers are required.
                </p>
                <fieldset className="wiz-group">
                  <legend>On-site, hybrid, or remote only?</legend>
                  <div className="wiz-chips">
                    {MODES.map((mode) => (
                      <button
                        aria-pressed={v.mode === mode.value}
                        className={`wiz-chip${v.mode === mode.value ? " is-on" : ""}`}
                        key={mode.value}
                        onClick={() => patch({ mode: mode.value })}
                        type="button"
                      >
                        <span className="wiz-chip-mark" aria-hidden="true">{v.mode === mode.value ? "✓" : ""}</span>
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="wiz-group">
                  <legend>Would you relocate for the right role?</legend>
                  <div className="wiz-chips">
                    {RELOCATE.map((option) => (
                      <button
                        aria-pressed={v.relocate === option.value}
                        className={`wiz-chip${v.relocate === option.value ? " is-on" : ""}`}
                        key={option.value}
                        onClick={() => patch({ relocate: option.value })}
                        type="button"
                      >
                        <span className="wiz-chip-mark" aria-hidden="true">{v.relocate === option.value ? "✓" : ""}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="wiz-group">
                  <legend>When could you start?</legend>
                  <div className="wiz-chips">
                    {AVAILABILITY.map((option) => (
                      <button
                        aria-pressed={v.availability === option}
                        className={`wiz-chip${v.availability === option ? " is-on" : ""}`}
                        key={option}
                        onClick={() => patch({ availability: option })}
                        type="button"
                      >
                        <span className="wiz-chip-mark" aria-hidden="true">{v.availability === option ? "✓" : ""}</span>
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <p className="onboarding-intro">
                  Employers ask for these on most application forms. Fill them once here and every prepared form starts
                  from the same answers.
                </p>
                <div className="wiz-fields">
                  <label>
                    <span>Phone</span>
                    <input
                      onChange={(event) => patch({ phone: event.target.value })}
                      placeholder="+91 98765 43210"
                      type="tel"
                      value={v.phone}
                    />
                  </label>
                  <label>
                    <span>LinkedIn</span>
                    <input
                      onChange={(event) => patch({ linkedin: event.target.value })}
                      placeholder="linkedin.com/in/you"
                      type="url"
                      value={v.linkedin}
                    />
                  </label>
                  <label>
                    <span>GitHub</span>
                    <input
                      onChange={(event) => patch({ github: event.target.value })}
                      placeholder="github.com/you"
                      type="url"
                      value={v.github}
                    />
                  </label>
                  <label>
                    <span>Portfolio</span>
                    <input
                      disabled={v.sameAsGithub}
                      onChange={(event) => patch({ portfolio: event.target.value })}
                      placeholder="yoursite.com"
                      type="url"
                      value={v.sameAsGithub ? v.github : v.portfolio}
                    />
                  </label>
                </div>
                <button
                  aria-pressed={v.sameAsGithub}
                  className={`wiz-chip${v.sameAsGithub ? " is-on" : ""}`}
                  onClick={() => patch({ sameAsGithub: !v.sameAsGithub })}
                  type="button"
                >
                  <span className="wiz-chip-mark" aria-hidden="true">{v.sameAsGithub ? "✓" : ""}</span>
                  Portfolio is the same as GitHub
                </button>

                <fieldset className="wiz-group">
                  <legend>Gender</legend>
                  <div className="wiz-chips">
                    {GENDERS.map((option) => (
                      <button
                        aria-pressed={v.gender === option}
                        className={`wiz-chip${v.gender === option ? " is-on" : ""}`}
                        key={option}
                        onClick={() => patch({ gender: option })}
                        type="button"
                      >
                        <span className="wiz-chip-mark" aria-hidden="true">{v.gender === option ? "✓" : ""}</span>
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="wiz-group">
                  <legend>Do you identify as having a disability?</legend>
                  <div className="wiz-chips">
                    {DISABILITY.map((option) => (
                      <button
                        aria-pressed={v.disability === option}
                        className={`wiz-chip${v.disability === option ? " is-on" : ""}`}
                        key={option}
                        onClick={() => patch({ disability: option })}
                        type="button"
                      >
                        <span className="wiz-chip-mark" aria-hidden="true">{v.disability === option ? "✓" : ""}</span>
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="wiz-exclude">
                  <span>Companies or words to never show</span>
                  <input
                    onChange={(event) => patch({ exclude: event.target.value })}
                    placeholder="Staffing agencies, a company name, a keyword"
                    type="text"
                    value={v.exclude}
                  />
                </label>

                <p className="wiz-fineprint">
                  We do not ask for an ATS board password and we never sign in as you. Board logins stay yours.
                </p>
              </>
            ) : null}
          </>
        )}

        <div className="wiz-nav">
          {brief ? (
            <button className="wiz-back" onClick={() => setBrief(false)} type="button">
              <span aria-hidden="true">←</span> Back
            </button>
          ) : step === 0 ? (
            <Link className="wiz-back" href="/onboarding/resume">
              <span aria-hidden="true">←</span> Resume
            </Link>
          ) : (
            <button className="wiz-back" onClick={() => setStep(step - 1)} type="button">
              <span aria-hidden="true">←</span> Back
            </button>
          )}

          {brief ? (
            <button className="wiz-next" type="submit">
              Save and see your match <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button className="wiz-next" disabled={!complete()} onClick={next} type="button">
              {step === STEPS.length - 1 ? "See your brief" : "Continue"} <span aria-hidden="true">→</span>
            </button>
          )}
        </div>

        <p className="wiz-skip">
          <Link href="/dashboard">Skip for now</Link>
          <span>·</span>
          <span>Your answers stay editable on your profile.</span>
        </p>
      </section>
    </form>
  );
}
