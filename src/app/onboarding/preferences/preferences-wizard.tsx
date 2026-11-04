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
  { n: 3, kicker: "Target roles", title: "What roles should we apply for?" },
  { n: 4, kicker: "Skills", title: "What are you great at?" },
  { n: 5, kicker: "Where", title: "Which cities should we search in?" },
  { n: 6, kicker: "Compensation", title: "Let's talk numbers." },
  { n: 7, kicker: "How you work", title: "How do you want to work?" },
  { n: 8, kicker: "Last details", title: "A few last details." },
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
  const skillChoices = [...new Set([...knownSkills, ...v.skills, "TypeScript", "Python", "React.js", "Node.js", "SQL"])].slice(0, 26);

  const current = STEPS[step];
  const progress = brief ? 100 : (current.n / 8) * 100;

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
    <>
      <div className="onboarding-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>

      <section aria-labelledby="wiz-title" className="onboarding-content wiz">
        <form action={savePreferences}>
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

          <p className="wiz-step">
            {brief ? (
              <>Before your first match</>
            ) : (
              <>
                <span>{String(current.n).padStart(2, "0")} / 08</span> · {current.kicker}
              </>
            )}
          </p>

          {brief ? (
            <div className="wiz-brief">
              <p className="section-kicker">Here&rsquo;s who you are</p>
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

              <p className="intake-privacy">
                These answers live on your account like any other confirmed fact. We never ask for an ATS board password,
                and we do not sign in as you.
              </p>
            </div>
          ) : (
            <>
              <p className="section-kicker">{current.kicker}</p>
              <h1 id="wiz-title">{current.title}</h1>

              {step === 0 ? (
                <>
                  <p className="onboarding-intro">
                    Select your top 3 titles. They join the title signal in every score, alongside the roles on your
                    resume{hasResume ? "" : " once you add one"}.
                  </p>
                  <p className="wiz-count">{v.roles.length} of 3 selected</p>
                  <div className="wiz-chips">
                    {roleChoices.map((role) => (
                      <button
                        aria-pressed={v.roles.includes(role)}
                        className={`wiz-chip${v.roles.includes(role) ? " is-on" : ""}`}
                        key={role}
                        onClick={() => toggleIn("roles", role, 3)}
                        type="button"
                      >
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
                      placeholder="add a role"
                      value={draft}
                    />
                    <button className="wiz-add-button" onClick={() => addDraft("roles")} type="button">Add</button>
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <p className="onboarding-intro">
                    Choose up to 5 as your top skills — the ones a recruiter should see first. They are weighed above
                    skills elsewhere on your profile.
                  </p>
                  <p className="wiz-count">{v.skills.length} of 5 top</p>
                  <div className="wiz-chips">
                    {skillChoices.map((skill) => (
                      <button
                        aria-pressed={v.skills.includes(skill)}
                        className={`wiz-chip${v.skills.includes(skill) ? " is-on" : ""}`}
                        key={skill}
                        onClick={() => toggleIn("skills", skill, 5)}
                        type="button"
                      >
                        {skill}
                      </button>
                    ))}
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
                      placeholder="add a skill"
                      value={draft}
                    />
                    <button className="wiz-add-button" onClick={() => addDraft("skills")} type="button">Add</button>
                  </div>
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
                    Pick at least one city, or switch on remote. These decide which postings are reachable, not just which
                    forms get filled.
                  </p>
                  <p className="wiz-count">{v.cities.length} {v.cities.length === 1 ? "city" : "cities"}</p>
                  <div className="wiz-chips">
                    {cities.map((city) => (
                      <button
                        aria-pressed={v.cities.includes(city)}
                        className={`wiz-chip${v.cities.includes(city) ? " is-on" : ""}`}
                        key={city}
                        onClick={() => toggleIn("cities", city, 8)}
                        type="button"
                      >
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
                      placeholder="add a city"
                      value={draft}
                    />
                    <button className="wiz-add-button" onClick={() => addDraft("cities")} type="button">Add</button>
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <p className="onboarding-intro">
                    We ask so postings that state less than you need can be filtered out of your feed, not ranked and then
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
                    Same as GitHub
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

                  <p className="intake-privacy">
                    We do not ask for an ATS board password and we never sign in as you. Board logins stay yours.
                  </p>
                </>
              ) : null}
            </>
          )}

          <div className="wiz-actions">
            {brief ? (
              <>
                <button className="onboarding-submit" type="submit">
                  Save and see your match <span aria-hidden="true">→</span>
                </button>
                <button className="intake-secondary" onClick={() => setBrief(false)} type="button">
                  Back
                </button>
                <Link className="text-button" href="/dashboard">Skip for now</Link>
              </>
            ) : (
              <>
                {step === 0 ? (
                  <Link className="text-button" href="/onboarding/resume">← Resume</Link>
                ) : (
                  <button className="intake-secondary" onClick={() => setStep(step - 1)} type="button">
                    Back
                  </button>
                )}
                <button className="onboarding-submit" disabled={!complete()} onClick={next} type="button">
                  {step === STEPS.length - 1 ? "See your brief" : "Continue"} <span aria-hidden="true">→</span>
                </button>
                <Link className="text-button" href="/dashboard">Skip for now</Link>
              </>
            )}
          </div>
        </form>
      </section>

      <footer className="onboarding-footer">
        <Link href="/profile">← Your profile</Link>
        <span>Change any answer later on your profile. Step {brief ? "8" : current.n} of 8.</span>
      </footer>
    </>
  );
}
