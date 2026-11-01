# Repository Intelligence

## Project Overview

`JobAutomation` is an India-first job-search and application product for New Grad/Fresher and Experienced candidates, with international use in mind. The GitHub repository was empty when supplied; this document and the starter app are its initial contents.

## Technology Stack

- Next.js App Router 16.3.6, React 19.3.0, TypeScript 5
- Tailwind CSS v4 through `@tailwindcss/postcss`
- npm package manager
- The landing page remains static; the first onboarding route has an interactive, in-memory candidate-path choice. No product data integrations are wired.

## Directory Structure

- `src/app/` — App Router root layout, homepage, onboarding route/client form and global CSS
- `.codex/repo-map.md` — this repository map
- Root configuration — npm scripts/dependencies, Next.js, TypeScript, ESLint and PostCSS

## Architecture

The app has a static public homepage and an onboarding route for choosing New Grad/Fresher or Experienced. The route preselects a path when opened from a homepage path card; submit shows an in-page confirmation only. The choice is not persisted. No domain modules, API, database, auth, worker, browser extension or external integrations exist yet. The intended longer-term architecture is a modular monolith; detailed decisions remain provisional in the parent workspace research.

## Application Entry Points

- `src/app/layout.tsx` — root HTML layout and page metadata
- `src/app/page.tsx` — public landing page
- `src/app/onboarding/page.tsx` — validates the optional `path` query value and renders the onboarding form
- `src/app/onboarding/onboarding-form.tsx` — accessible career-path choice and confirmation state

## Important Files

- `src/app/page.tsx` — marketing page; Get started and the two path cards open onboarding
- `src/app/onboarding/page.tsx` and `onboarding-form.tsx` — initial path-selection flow; no profile or account persistence
- `src/app/globals.css` — responsive landing/onboarding styles and reduced-motion handling
- `package.json` — dependency versions and dev/build/lint/typecheck commands
- `next.config.ts` — minimal Next.js configuration
- `AGENTS.md` — repository development and product constraints

## Module Relationships

`layout.tsx` imports global CSS and renders both routes. Homepage career cards pass a validated path query value to the onboarding server route. The client form keeps selection/confirmation in component state; it has no API or persistence dependency.

## Dependency Graph

The root package depends on Next.js/React. Tailwind's PostCSS plugin, TypeScript types and ESLint/Next config are development dependencies. No additional UI, database, auth or AI dependencies are installed/configured in source.

## API Map

No API routes or server actions exist.

## Database Architecture

No database, schema or migration exists.

## Authentication & Authorization

No authentication or authorization exists.

## External Services

No external services are configured or called.

## Configuration

No environment variables are currently required. `next.config.ts` only disables the `X-Powered-By` header.

## Important Application Flows

The homepage retains in-page navigation for informational sections; its primary CTAs route to `/onboarding`. That route lets the candidate choose a path and see the next-step guidance. It does not create accounts, save the choice or upload a resume.

## Coding Conventions

- TypeScript and React Server Components by default.
- App Router under `src/app/`; `@/*` maps to `src/*`.
- Keep accessible semantic markup and responsive behavior in the page/CSS.

## Testing Architecture

No tests are configured or present. `lint` and `typecheck` scripts are available; neither was run during setup.

## Build & Deployment

- `npm run dev` starts the development server.
- `npm run build` and `npm run start` are defined for production.
- No CI, container, hosting or deployment files exist yet.

## Risks / Important Constraints

- Do not present roadmap capabilities as currently implemented.
- Do not reuse Dossier code before licensing and integration review.
- Job-source access, ATS form schemas and submission authority are not integrated.
- Onboarding path selection is temporary UI state; no user data is persisted or transmitted.

## Frequently Modified Areas

The landing route, onboarding route/client form and global stylesheet are the first UI files.
