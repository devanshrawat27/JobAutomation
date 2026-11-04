# JobAutomation

An India-first job-search workspace for New Grad/Fresher and Experienced applicants, designed to support international use. The product direction prioritizes a verified candidate profile, source-aware job discovery, truthful application preparation, and user review before an application is submitted.

The interface follows `BRAND.md` at the workspace root (BRAND.md spec 0.3.0): Ink `#0E1729` for text, Paper `#FBFCFE` for grounds, Signal Blue `#2563EB` as the single accent, Night `#0E1526` for dark surfaces. Inter is the single typeface — headings at weight 630–650 with tight tracking — self-hosted through `next/font` under the SIL Open Font License. Light is the default theme; a Light / Dark / Auto switch sits at the bottom-right of every page, and only Auto follows the operating system.

Surfaces stay flat and quiet: hairline borders instead of drop shadows, ink-filled primary buttons instead of gradient pills, sentence-case labels instead of tracked-out uppercase, and one accent used only for links, selection and status. No background glows, no gradient text, no floating chrome.

## Current foundation

- Next.js App Router, React and TypeScript
- Tailwind CSS v4 for future component styling
- Responsive public landing page in one plain-grotesque register: centred hero with a two-line headline, a product shot labelled illustrative, three steps, four differentiators, a plainly answered FAQ and one closing action. Inter throughout, headings at 630–650 with tight tracking, light and dark both designed
- Onboarding step 1: New Grad/Fresher and Experienced path selection
- Onboarding step 2: upload a PDF or DOCX (signed-in accounts only) and review each proposed fact. Text-layer PDFs and DOCX read directly; scanned PDFs fall back to English OCR (up to three pages; Tesseract downloads its language data into the OS temp cache on first use) and say so on screen. Extraction uses Google Gemini with a source-quote guard and a local rules fallback. One card per company (“Company — Role”, dates, bullets) and one card per project (name, stack, bullets); editing uses labelled fields
- Accounts with Better Auth (email + password), PostgreSQL and Prisma; reviewed facts are saved per user and listed on `/profile`. Once a profile exists, onboarding shows the saved profile instead of the upload box, facts can be edited in place on `/profile`, and a second resume is an explicit "add a newer version" action: it merges — new cards are added, recognised cards are refreshed with their saved value shown, already-saved cards are pre-confirmed, and nothing is deleted
- **`/dashboard` is the signed-in Overview** and the first page after onboarding: four real counts (new matches, shortlisted, applications in progress, follow-ups due), the strongest four matches with score, matched skills, gaps, eligibility and posting-trust state, the application pipeline with submit-attempted and receipt-confirmed kept apart, profile readiness, a truthful scanner-health panel and a recent-activity list. Every number comes from the session user's own rows; an account with no confirmed fact is sent back to onboarding. Save/dismiss works from the dashboard. Sidebar order: Overview, Discover jobs, Applications, Documents, My profile, Daily digest
- `/jobs` reads verified public boards with the employer's own apply links. Postings are stored in Postgres by a background scanner (`npm run jobs:worker`, every 15 minutes, or `npm run jobs:scan` for a one-off) and closed only when they disappear from a board. The list itself shows the last 14 days; age is a listing rule, not a closure. It opens on “For you”, ranked by a five-part score — named skills (45, with must-have skills from the posting weighted double), title against your roles (20), the years asked for versus your dated experience (15, neutral when the posting does not state years), location (10) and freshness (5) — with the matched skills, the gaps and a plain reason on each card. All/Saved/Dismissed tabs; save or dismiss any posting per account. Discovery only, no auto-apply
- **One resolver serves every source.** Detail, prepare, answers and `/api/answers` all read the stored corpus row first (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, HN, Mastodon, pasted, captured) and only call a board when the row is missing. No page hardcodes a numeric id or assumes Greenhouse
- **Pay is read from the posting, not guessed.** "₹15–25 LPA", "₹1.8–4.2L", "12–18 lakhs" and "₹50,000 per month" normalise to lakhs per annum; business volume (GMV, revenue, account counts) is rejected. The figure shows on the card, the job page and the dashboard, the list filters on it, and the header reports the median **of the postings that state pay** — common on Indian boards, rare on the ATS boards we read, and shown as "—" when nobody states it
- **Posted filter**: last 6 hours, 24 hours, 3 days or 7 days, on top of the 14-day listing window. The scanner runs every fifteen minutes, so a 24-hour view is real rather than decorative
- **When the list is thin, it says why and what would fix it**: `/jobs` names the one active filter worth relaxing and the exact number of roles it would add ("any pay +1,232"), computed against the current corpus rather than guessed
- **Referral kit on a job page**: three searches the candidate runs in their own session (people at the company, recruiters/HR, alumni or public profiles) and a message written only from confirmed facts. Nothing is scraped, stored or sent; the copy button is the whole hand-off
- **Every tailored resume now carries a contact block** (name, email, phone, city, links) copied from confirmed facts before the model's draft, so the PDF and the text an ATS reads both start with a way to reach the candidate
- **ATS read on each resume** (`/documents/[id]`): a deterministic 0–100 with eight checks — contact, standard sections, dated roles, quantified bullets, action-verb openers, no first person, length, and keyword coverage against the posting's named skills. Every point is a rule, not a model opinion
- **Scan any resume** at `/ats`: a three-step wizard (resume → target role → analyze) that accepts a PDF/DOCX up to 10 MB, reads it in memory, discards it, and returns the same eight checks. Nothing is stored and the scan is not attached to the profile
- **Company pages** (`/company`, `/company/[slug]`): public employers from the corpus, open-role counts, a median of stated pay, and the newest roles, built only from public postings — private captures never appear
- Every posting page also answers two India-specific questions: **do you meet the stated criteria** (CGPA floor, batch year, degree, percentage — compared with your education facts) and **is this posting safe** (fee requests, data-entry patterns, chat-only contact, shortened links, implausible pay, lookalike characters), each with the sentence that triggered it. The same two signals appear as chips on the cards
- `/jobs/[board]/[id]` shows how your confirmed facts answer each requirement, with the exact quote from both sides. “N+ years” is computed from your dated experience, never guessed. Postings with mixed-script lookalike words are flagged
- Cover letters are drafted from confirmed facts only, saved to `/documents`, and each paragraph is checked: unsupported numbers are removed before you see the draft
- Letters are editable; saving re-checks numbers against the cited facts and refuses anything unsupported
- Tailored resumes are built from the same facts, with any unsupported line removed and listed
- Every document downloads as a real PDF and can be rebuilt from the current profile without overwriting the original; rebuilds form a version chain you can compare line by line
- Cover letters and resumes both get a second reviewer pass, and its notes are kept with the document; medium/high notes can drive a one-click regeneration. If the reviewer itself fails, the document says **“Reviewer did not run”** — a missing pass is never shown as a clean one
- `/digest` is the in-app daily summary: new matches from the last two days, shortlisted postings about to leave the 14-day window, applications that have waited a week, and profile areas still empty — computed from your own records, no bot token needed
- `/applications` tracks prepared → form filled → submit attempted → receipt confirmed → outcome, with a timestamped history, a pinned profile snapshot and a diff of what changed since
- `/jobs/[board]/[id]/answers` lists the fields employer forms ask for, ready to copy, with the facts that answer them and the ones that need you

## Requirements

- Node.js 20.9 or newer
- npm 11.8 or compatible
- Docker (for the local Postgres container)

## Local development

Copy `.env.example` to `.env` first. It holds `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `JOBS_WORKER_SECRET`; no real credentials belong in the repository.

`POST /api/jobs/sync` fails closed: it answers 401 unless the caller sends `x-worker-secret` matching `JOBS_WORKER_SECRET`, so a public URL cannot start scans. The worker reads the same variable:

```bash
JOBS_WORKER_SECRET=… npm run jobs:worker
```

Scanning manually from `/jobs` needs a signed-in session and is limited to one scan per account every two minutes; an in-progress scan is reported instead of queued.

```bash
npm install
npm run db:up      # Postgres 18 on localhost:5433 from compose.dev.yml
npm run db:migrate # apply prisma/migrations
npm run dev
```

Open the local URL printed by Next.js in the terminal. If port 3000 is occupied, Next.js will use the next available port (for example, `http://localhost:3001`).

## Available commands

```bash
npm run dev          # Start the development server
npm run build        # Create a production build
npm run start        # Serve the production build
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript without emitting files
npm run db:up        # Start the local Postgres container
npm run db:down      # Stop it
npm run db:migrate   # Create/apply a migration
npm run db:studio    # Open Prisma Studio
```

## Product constraints

- Support both New Grad/Fresher and Experienced applicants through guided paths over a shared profile.
- Treat resume extraction as a proposal; users confirm or correct career facts.
- Keep job discovery, form preparation, submission attempt and confirmed receipt as distinct states.
- Do not copy Dossier source or assets until the reuse and AGPL-3.0-only licensing decision is reviewed.
- Follow source-specific job-site terms; do not bypass CAPTCHA, MFA or access restrictions.
