# Competitor read: myjobb.ai

Accessed 4 Nov 2026. Public pages only (`/`, `/features`, `/features/ai-job-matching`, `/features/referral-finder`, `/features/ai-resume-builder`, `/pricing`, `/changelog`, `/jobs/browse`, one city/role listing). No account was created and no private screen was opened. The workspace now explicitly permits REA on public/black-box competitor surfaces (public pages, shipped bundles, public endpoints, store-listed extensions); an earlier public analysis of myjobb already sits in `reverse Engineering/myjobb-engine-analysis.md`.

## What they are

An India-first "AI job agent" that finds jobs, auto-applies through the candidate's own sessions on Naukri, Foundit, Hirist, IIMJobs and Instahyre plus Workday/Greenhouse/Ashby career pages, tailors a LaTeX resume, tracks replies, and sells prepaid application packs (Pro ₹999 / 350 applications, Max ₹1,999 / 1,000, 20 free once, quarterly 20% off, no auto-renew).

## Their engine, as documented

1. **Limits before scoring** — closed, older than 45 days, outside the candidate's cities and not remote, listed salary below 60% of the floor, experience more than five years away, already applied/saved/dismissed.
2. **Embeddings for role titles** (`gemini-embedding-001`), plus every job posted in the last seven days that clears the limits.
3. **Learned ranker over ~40 signals** — title wording/meaning, same kind of work, skill coverage, experience/seniority gap, location and mode, description, freshness, employment history; an occupation check so "Founding Designer" does not match a backend engineer.
4. **Calibrated %** with labels 85+/70–84/60–69/<60; unknown experience stays unknown instead of being read as entry level.
5. **Reasons are the model's own arithmetic**, family by family, adding to the total.

## Their product surface

- 15+ sources including Indian boards; explicit exclusion of LinkedIn and Lever.
- Public catalogue: 73k jobs, city and role landing pages, company pages, salary medians, work-mode/experience/salary/posted filters, sort orders.
- Referral finder: Google searches over public LinkedIn profiles, Gemini reads the top 30, ranks 10, drafts a DM and a forwardable pitch; never sends from LinkedIn.
- Cold email from the user's Gmail/Outlook.
- ATS checker (deterministic + keyword + LLM tiers, two scores, five scans a day).
- WhatsApp agent, job-capture extension to connect boards, application log, reply/stage tracking.
- Honest limits stated on their pages: no LinkedIn auto-apply, no referral guarantee, no invented ties.

## Comparison with our engine

| Area | myjobb | Us | Gap |
|---|---|---|---|
| Matching | learned ranker, embeddings, calibrated % | deterministic five-signal score + family gate + fresher model, every reason traceable | They have semantic title similarity; we have explainability and no training data need |
| Sources | Indian boards + ATS | ATS (GH/Lever/Ashby/SmartRecruiters) + HN/Mastodon + paste/capture | We cannot read Naukri/Foundit/Hirist under their terms; we cover ATS and community posts |
| Pay | salary field from boards, filters, medians | **added this pass**: parsed from posting text, filter, median when stated | Our boards rarely state pay, so coverage is honest but thin |
| Freshness | 6h/24h feeds | 14-day window; **added** 24h/3d/7d filter | Their 6h needs a denser scan cadence |
| Referrals | Google over public profiles, ranked, drafted | **added**: three own-session searches + draft from confirmed facts; no scraping, no storage | They rank people; we deliberately do not read profiles |
| ATS | checker + builder score | number guard + second reviewer; no ATS score | Real gap, not built yet |
| Apply | auto-submit via the candidate's session | prepare only; submit stays with the user | Product principle and terms |
| Evidence | reasons per job | fact-level citations, requirement-level quotes, eligibility, scam flags, submit vs receipt states | Our trust layer is stronger |

## Adopted in this pass

- **Pay parsing** (`src/lib/jobs/salary.ts`): LPA, lakh, monthly and single figures normalised to lakhs per annum; business volume (GMV, revenue, accounts) rejected. Stored on the posting, shown on cards/detail/dashboard, filterable, median in the header. 15 tests pass.
- **Posted filter**: last 24 hours / 3 days / 7 days, alongside the existing 14-day listing window.
- **Referral kit on the job page**: three searches the candidate runs in their own session (LinkedIn people, recruiters, alumni or public profiles) and a draft written only from confirmed facts. Nothing is fetched, stored or sent.

## Deliberately not adopted

- Auto-apply through the candidate's Naukri/session. It conflicts with our "you press submit" rule and with the boards' terms.
- Scraping LinkedIn profiles or ranking people. Their approach uses Google over public pages; we keep the user in their own session instead.
- Indian-board ingestion (Naukri, Foundit, Hirist, Instahyre, IIMJobs, Indeed, Internshala). No public APIs; the terms do not permit automated reads.
- WhatsApp agent and cold-email sending until a provider and consent flow are authorised.

## Still open after this pass

- ATS score for an uploaded or generated resume (deterministic + keyword), and a company page built from our corpus.
- Semantic title similarity without a trained model (embeddings over stored titles, if a provider key is available).
- A denser scan cadence if we want a 6-hour view.
