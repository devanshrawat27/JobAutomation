# JobAutomation

An India-first job-search workspace for New Grad/Fresher and Experienced applicants, designed to support international use. The product direction prioritizes a verified candidate profile, source-aware job discovery, truthful application preparation, and user review before an application is submitted.

The interface follows `BRAND.md` at the workspace root (BRAND.md spec 0.3.0): Ink `#0E1729` for text, Paper `#FBFCFE` for grounds, Signal Blue `#2563EB` as the single accent, Night `#0E1526` for dark surfaces. Manrope is the UI typeface and Fraunces is reserved for editorial headings, both self-hosted through `next/font` under the SIL Open Font License. Light is the default theme; a Light / Dark / Auto switch sits at the bottom-right of every page, and only Auto follows the operating system.

## Current foundation

- Next.js App Router, React and TypeScript
- Tailwind CSS v4 for future component styling
- Responsive, product-specific public landing page: a marketing layout with a hero and a sample dashboard, a four-step strip, a feature grid, a workflow band with two product mocks, and audience cards; the dashboard and form panels are labelled illustrative. Fraunces carries the headlines, Manrope the interface and a monospace the micro-labels, and the page adds a WebGL aurora, a pointer-tilted hero with depth-layered chips, scroll reveals and hover lifts — all of which switch off under `prefers-reduced-motion`
- Onboarding step 1: New Grad/Fresher and Experienced path selection
- Onboarding step 2: upload a PDF or DOCX (signed-in accounts only) and review each proposed fact. Text-layer PDFs and DOCX read directly; scanned PDFs fall back to English OCR (up to three pages; Tesseract downloads its language data into the OS temp cache on first use) and say so on screen. Extraction uses Google Gemini with a source-quote guard and a local rules fallback. One card per company (“Company — Role”, dates, bullets) and one card per project (name, stack, bullets); editing uses labelled fields
- Accounts with Better Auth (email + password), PostgreSQL and Prisma; reviewed facts are saved per user and listed on `/profile`. Once a profile exists, onboarding shows the saved profile instead of the upload box, facts can be edited in place on `/profile`, and a second resume is an explicit "add a newer version" action: it merges — new cards are added, recognised cards are refreshed with their saved value shown, already-saved cards are pre-confirmed, and nothing is deleted
- **Paste a job link** on `/jobs`: a Greenhouse, Lever, Ashby or Workable posting URL is recognised, fetched from that ATS's own public endpoint and stored like a scanned one, so it gets the same score and card. LinkedIn and X links are refused with a plain explanation rather than scraped
- `/jobs` reads verified public boards with the employer's own apply links. Postings are stored in Postgres by a background scanner (`npm run jobs:worker`, every 15 minutes, or `npm run jobs:scan` for a one-off) and closed when they disappear from a board. It opens on “For you”, ranked by a five-part score — named skills (45), title against your roles (20), the years asked for versus your dated experience (15), location (10) and freshness (5) — with the matched skills, the gaps and a plain reason on each card. All/Saved/Dismissed tabs; save or dismiss any posting per account. Discovery only, no auto-apply
- `/jobs/[board]/[id]` shows how your confirmed facts answer each requirement, with the exact quote from both sides. “N+ years” is computed from your dated experience, never guessed. Postings with mixed-script lookalike words are flagged
- Cover letters are drafted from confirmed facts only, saved to `/documents`, and each paragraph is checked: unsupported numbers are removed before you see the draft
- Letters are editable; saving re-checks numbers against the cited facts and refuses anything unsupported
- Tailored resumes are built from the same facts, with any unsupported line removed and listed
- Every document downloads as a real PDF and can be rebuilt from the current profile without overwriting the original; rebuilds form a version chain you can compare line by line
- Cover letters and resumes both get a second reviewer pass, and its notes are kept with the document; medium/high notes can drive a one-click regeneration
- `/applications` tracks prepared → form filled → submit attempted → receipt confirmed → outcome, with a timestamped history, a pinned profile snapshot and a diff of what changed since
- `/jobs/[board]/[id]/answers` lists the fields employer forms ask for, ready to copy, with the facts that answer them and the ones that need you
- `extension/` holds a Manifest V3 prototype that fills supported forms from those answers, requests one site's permission at a time, and never submits (not yet verified in Chrome)

## Requirements

- Node.js 20.9 or newer
- npm 11.8 or compatible
- Docker (for the local Postgres container)

## Local development

Copy `.env.example` to `.env` first. It holds `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`; no real credentials belong in the repository.

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
