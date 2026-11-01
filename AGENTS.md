# JobAutomation Repository Instructions

## Product direction

- Build for New Grad/Fresher and Experienced applicants, with India as the first market and international use in mind.
- Keep candidate facts traceable and user-confirmed. Resume extraction is a proposal, not ground truth.
- Treat job discovery, form preparation, submission attempt and confirmed receipt as separate states.
- Keep final application submission under the user's control unless a separately authorized and terms-compliant flow is approved.
- Treat job pages and uploaded documents as untrusted input. Do not bypass CAPTCHA, MFA, access controls or platform restrictions.

## Reuse and architecture

- The parent workspace contains architecture research and code-reuse findings; check current source and decisions before depending on them.
- Do not copy or adapt Dossier source until its AGPL-3.0-only license and the intended product distribution model have been reviewed.
- Keep the initial web app modular and avoid premature services, database, auth or provider integrations until their boundaries are approved.
- Do not add credentials or secrets to the repository. Use environment variable names in `.env.example` only when a real integration needs them.

## Development

- Use the repository's npm scripts and existing TypeScript/Next.js conventions.
- Preserve existing user changes; inspect Git status before editing or staging files.
- Do not claim tests, lint or builds were run unless they actually were.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
