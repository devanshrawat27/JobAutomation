# jobautomation form assistant (prototype)

A minimal Chrome Manifest V3 extension that fills employer application forms from
your **confirmed** profile facts. It never submits anything.

## What it does

1. You open the employer's application page.
2. Open the extension, enter the board token and posting id shown on your
   `/jobs/<board>/<id>/answers` page.
3. It asks permission for **that one site**, then fetches
   `/api/answers?board=…&id=…` using your signed-in session.
4. It fills only empty fields whose label, name, placeholder or `aria-label`
   clearly matches an answer, marks each filled field, and reports what it left
   alone.

## Safety rules it follows

- No submit, no file upload, no password fields, no CAPTCHA handling.
- Permission is requested per site, on demand; there is no all-sites access by
  default.
- Fields that already have a value are skipped, not overwritten.
- Eligibility and availability answers never get invented: if the profile has no
  value, the field is left empty and listed as "needs you".

## Load it locally

1. Keep the web app running at `http://localhost:3001` and sign in there.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Open an employer application form, then use the extension popup.

If you change the API origin, update both `host_permissions` in `manifest.json`
and `API_ORIGIN` in `popup.js`.

## Status

Prototype. The matching is deterministic (label keywords), it has not been
verified against live employer forms yet, and it does not support iframes,
shadow DOM or forms that render fields after a multi-step navigation.


## Saving jobs from LinkedIn, X or anywhere else

Those sites refuse automated reads and their terms forbid them, so the
extension never crawls. It reads only what is already on screen, when you ask:

1. Open `/jobs` in the app and copy the personal token from
   "Save the job you are looking at".
2. Load the extension, paste the token, and keep it (it is stored in
   `chrome.storage`).
3. On a posting: **Save this job**. On a feed: **Find hiring posts on this
   page**, untick what you do not want, then **Save the ticked posts**.

Each saved post goes to `POST /api/jobs/capture` with your token, lands in the
same corpus as the board postings, and gets the same skill, seniority and years
extraction. Nothing is submitted to an employer.
