const API_ORIGIN = "http://localhost:3001";

const PATTERNS = {
  "contact.firstName": [/first\s*name|given\s*name/i],
  "contact.lastName": [/last\s*name|surname|family\s*name/i],
  "contact.fullName": [/full\s*name/i, /^name$/i, /\byour name\b/i],
  "contact.email": [/e-?mail/i],
  "contact.phone": [/phone|mobile|contact number/i],
  "contact.location": [/current location|location|city|based in/i],
  "contact.country": [/^country$|country of residence/i],
  "contact.linkedin": [/linkedin/i],
  "contact.website": [/portfolio|website|github|personal site/i],
  "education.institution": [/institution|university|college|school/i],
  "education.degree": [/degree|discipline|course|branch|major/i],
  "education.grade": [/cgpa|gpa|grade|percentage|marks/i],
  "education.graduation": [/graduat|passing|batch|class of/i],
  "experience.company": [/current company|employer|company/i],
  "experience.role": [/job title|designation|current role|\brole\b/i],
  "experience.dates": [/dates?|duration|period/i],
  skills: [/skills?/i],
  "eligibility.authorization": [/work authori|right to work|visa|sponsor/i],
  "eligibility.notice": [/notice period|earliest start|available to join|availability/i],
  "preferences.salary": [/expected (salary|compensation)|salary expectation/i],
  "preferences.relocation": [/relocat/i],
};

/**
 * Runs inside the employer page. Fills only empty fields, dispatches the events
 * frameworks listen to, marks what it touched, and never submits.
 */
function fillForm(answers) {
  const fields = Array.from(
    document.querySelectorAll("input, textarea, select"),
  ).filter((element) => {
    if (element.closest("[aria-hidden='true']")) return false;
    if (element.disabled || element.readOnly) return false;
    const type = (element.getAttribute("type") || "").toLowerCase();
    return !["hidden", "submit", "button", "reset", "file", "image", "checkbox", "radio", "password"].includes(type);
  });

  function describe(element) {
    const parts = [];
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) parts.push(label.textContent || "");
    }
    const wrapping = element.closest("label");
    if (wrapping) parts.push(wrapping.textContent || "");
    parts.push(element.getAttribute("aria-label") || "");
    parts.push(element.getAttribute("placeholder") || "");
    parts.push(element.getAttribute("name") || "");
    parts.push(element.id || "");
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  const used = new Set();
  const filled = [];
  const skipped = [];

  for (const answer of answers) {
    if (!answer.value) continue;
    const patterns = PATTERNS[answer.id];
    if (!patterns) continue;

    const field = fields.find((element) => {
      if (used.has(element)) return false;
      const text = describe(element);
      return patterns.some((pattern) => pattern.test(text));
    });

    if (!field) continue;
    used.add(field);

    if (field.value && field.value.trim()) {
      skipped.push({ label: answer.label, reason: "field already has a value" });
      continue;
    }

    if (field.tagName === "SELECT") {
      const option = Array.from(field.options).find(
        (entry) => entry.value.toLowerCase() === answer.value.toLowerCase() ||
          entry.textContent.trim().toLowerCase() === answer.value.toLowerCase(),
      );
      if (!option) {
        skipped.push({ label: answer.label, reason: "no matching option" });
        continue;
      }
      field.value = option.value;
    } else {
      field.value = answer.value;
    }

    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.style.outline = "2px solid #ffc928";
    field.style.outlineOffset = "1px";
    field.dataset.jobautomationFilled = answer.id;
    filled.push({ label: answer.label });
  }

  // Custom questions, answered only from confirmed facts.
  const skills = answers.find((answer) => answer.id === "skills")?.value ?? "";
  const skillList = skills.toLowerCase().split(/[,;·|]/).map((item) => item.trim()).filter(Boolean);
  const years = answers.find((answer) => answer.id === "experience.years")?.value ?? "";
  const usedLabels = new Set(filled.map((item) => item.label));

  const labelOf = (element) => [
    element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : "",
    element.closest("label")?.textContent,
    element.getAttribute("aria-label"),
    element.parentElement?.textContent?.slice(0, 120),
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  for (const element of document.querySelectorAll("input, textarea, select")) {
    if (used.has(element) || element.disabled || element.readOnly) continue;
    if (element.value && element.value.trim()) continue;

    const label = labelOf(element);
    if (!label || label.length < 6) continue;

    let value = null;

    if (/years of experience|total experience|experience in years/i.test(label) && years) {
      value = String(years);
    } else {
      const skillQuestion = label.match(/(?:experience|familiar|worked|proficien\w*)\s+(?:with|in)\s+([a-z0-9+#.\s]{2,40})/i);
      if (skillQuestion) {
        const asked = skillQuestion[1].toLowerCase().trim();
        const owned = skillList.some((skill) => asked.includes(skill) || skill.includes(asked));
        if (owned) value = /\b(yes|no)\b/i.test(label) || element.tagName === "SELECT" ? "Yes" : "Yes";
      }
    }

    if (!value) continue;

    if (element.tagName === "SELECT") {
      const option = [...element.options].find((entry) => entry.textContent.trim().toLowerCase() === value.toLowerCase());
      if (!option) continue;
      element.value = option.value;
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    used.add(element);
    filled.push({ label: label.slice(0, 60) + " (from your facts)" });
    usedLabels.add(label);
  }

  return {
    filled,
    skipped,
    missing: answers.filter((answer) => !answer.value).map((answer) => answer.label),
    detectedFields: fields.length,
  };
}

function status(text, isError = false) {
  const element = document.getElementById("status");
  element.textContent = text;
  element.classList.toggle("error", isError);
}

async function requestHostAccess(origin) {
  const has = await chrome.permissions.contains({ origins: [`${origin}/*`] });
  if (has) return true;
  return chrome.permissions.request({ origins: [`${origin}/*`] });
}

document.getElementById("fill").addEventListener("click", async () => {
  const board = document.getElementById("board").value.trim();
  const id = document.getElementById("id").value.trim();
  if (!board || !id) {
    status("Enter the board token and posting id from your jobautomation answers page.", true);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    status("No active tab.", true);
    return;
  }

  const origin = new URL(tab.url).origin;
  const granted = await requestHostAccess(origin);
  if (!granted) {
    status("This site was not allowed, so nothing was changed.", true);
    return;
  }

  status("Reading your confirmed answers…");

  let answers;
  try {
    const response = await fetch(`${API_ORIGIN}/api/answers?board=${encodeURIComponent(board)}&id=${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (response.status === 401) {
      status("Sign in to jobautomation in this browser first, then try again.", true);
      return;
    }
    if (!response.ok) {
      status(`Answers could not be loaded (${response.status}).`, true);
      return;
    }
    ({ answers } = await response.json());
  } catch {
    status("Could not reach jobautomation. Is the app running on localhost:3001?", true);
    return;
  }

  // Some ATS forms ask for first and last name separately.
  const fullName = answers["contact.fullName"];
  if (typeof fullName === "string" && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    answers["contact.firstName"] = parts[0];
    answers["contact.lastName"] = parts.slice(1).join(" ");
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillForm,
    args: [answers],
  });

  const outcome = result?.result;
  if (!outcome) {
    status("Nothing was filled. This page may block scripts.", true);
    return;
  }

  const lines = [
    `Filled ${outcome.filled.length} field(s) of ${outcome.detectedFields} detected.`,
    outcome.filled.length ? `• ${outcome.filled.map((item) => item.label).join("\n• ")}` : "",
    outcome.skipped.length ? `\nLeft alone:\n• ${outcome.skipped.map((item) => `${item.label} (${item.reason})`).join("\n• ")}` : "",
    outcome.missing.length ? `\nNeeds you:\n• ${outcome.missing.join("\n• ")}` : "",
    "\nReview the page. Submit is yours.",
  ].filter(Boolean);

  status(lines.join("\n"));
});


/**
 * Reads the posting that is already open in the tab.
 *
 * Runs in the page, so it only sees what the candidate sees. LinkedIn and X
 * both expose the job title, company and description in visible DOM and in
 * meta tags; the generic fallbacks keep it working on any careers page.
 */
function collectJob() {
  const text = (element) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
  const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) ?? "";

  const site = location.hostname;

  const title =
    text(document.querySelector("h1")) ||
    text(document.querySelector(".job-details-jobs-unified-top-card__job-title")) ||
    text(document.querySelector("[data-testid='jobsearch-JobInfoHeader-title']")) ||
    attr("meta[property='og:title']", "content") ||
    document.title.split("|")[0].trim();

  const company =
    text(document.querySelector(".job-details-jobs-unified-top-card__company-name a")) ||
    text(document.querySelector(".job-details-jobs-unified-top-card__company-name")) ||
    text(document.querySelector("[data-testid='inlineHeader-companyName']")) ||
    text(document.querySelector("a[href^='/company/']")) ||
    text(document.querySelector("[data-testid='User-Name']")) ||
    "";

  const place =
    text(document.querySelector(".job-details-jobs-unified-top-card__bullet")) ||
    text(document.querySelector("[data-testid='inlineHeader-companyLocation']")) ||
    text(document.querySelector(".job-details-jobs-unified-top-card__workplace-type")) ||
    "";

  const body =
    text(document.querySelector(".jobs-description__content")) ||
    text(document.querySelector(".jobs-box__html-content")) ||
    text(document.querySelector("[data-testid='jobDescriptionText']")) ||
    text(document.querySelector("article")) ||
    text(document.querySelector("main")) ||
    text(document.body).slice(0, 8000);

  // An application page carries the form, not the posting. The server knows how
  // to fetch the posting from the ATS URL, so send that instead of form text.
  const isFormPage =
    /indicate a required field|first name\s*\*|last name\s*\*|resume\/cv\s*\*|submit application/i.test(
      body.slice(0, 800),
    );

  const canonical =
    document.querySelector("link[rel='canonical']")?.getAttribute("href") ||
    document.querySelector("meta[property='og:url']")?.getAttribute("content") ||
    location.href;

  return {
    url: canonical,
    title,
    company: company.replace(/\s+careers?$/i, "").trim(),
    location: place,
    text: isFormPage ? "" : body,
    site,
    isFormPage,
  };
}

const scanButton = document.getElementById("scan");
const foundBox = document.getElementById("found");
const saveFoundButton = document.getElementById("saveFound");

if (scanButton) {
  scanButton.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    saveStatus.textContent = "Looking at what is on screen…";
    saveStatus.className = "";

    let posts = [];
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: findHiringPosts });
      posts = result?.result ?? [];
    } catch {
      saveStatus.textContent = "This page does not allow scripts.";
      saveStatus.className = "error";
      return;
    }

    foundBox.innerHTML = "";
    saveFoundButton.hidden = posts.length === 0;

    if (posts.length === 0) {
      saveStatus.textContent = "No hiring posts in view. Scroll the feed a little, then try again.";
      return;
    }

    posts.forEach((post, index) => {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = true;
      box.dataset.index = String(index);

      const body = document.createElement("span");
      body.textContent = post.title || "Hiring post";
      const meta = document.createElement("small");
      meta.textContent = post.company || new URL(post.url).hostname;
      body.appendChild(meta);

      label.append(box, body);
      foundBox.appendChild(label);
    });

    foundBox.dataset.payload = JSON.stringify(posts);
    saveStatus.textContent = `Found ${posts.length} post(s). Untick what you do not want, then save.`;
  });
}

if (saveFoundButton) {
  saveFoundButton.addEventListener("click", async () => {
    const token = (tokenInput?.value ?? "").trim();
    if (!token) {
      saveStatus.textContent = "Paste the token from your /jobs page first.";
      saveStatus.className = "error";
      return;
    }

    const posts = JSON.parse(foundBox.dataset.payload ?? "[]");
    const ticked = [...foundBox.querySelectorAll("input[type=checkbox]")]
      .filter((box) => box.checked)
      .map((box) => posts[Number(box.dataset.index)])
      .filter(Boolean);

    if (ticked.length === 0) {
      saveStatus.textContent = "Nothing ticked.";
      return;
    }

    saveStatus.textContent = `Saving ${ticked.length}…`;
    let saved = 0;

    for (const post of ticked) {
      try {
        const response = await fetch(`${API_ORIGIN}/api/jobs/capture`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-capture-token": token },
          body: JSON.stringify({
            url: post.url,
            title: post.title || "Hiring post",
            company: post.company,
            location: "",
            text: post.text,
          }),
        });
        const payload = await response.json();
        if (response.ok && payload.ok) saved += 1;
      } catch {
        // Keep going: one failure should not stop the rest.
      }
    }

    await chrome.storage.local.set({ captureToken: token });
    saveStatus.textContent = `Saved ${saved} of ${ticked.length}. Open /jobs to see their match scores.`;
    saveStatus.className = "";
  });
}

const saveButton = document.getElementById("save");
const saveStatus = document.getElementById("saveStatus");
const tokenInput = document.getElementById("token");

if (saveButton) {
  chrome.storage.local.get("captureToken").then(({ captureToken }) => {
    if (captureToken && tokenInput) tokenInput.value = captureToken;
  });

  saveButton.addEventListener("click", async () => {
    const token = (tokenInput?.value ?? "").trim();
    if (!token) {
      saveStatus.textContent = "Paste the token from your /jobs page first.";
      saveStatus.className = "error";
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    saveStatus.textContent = "Reading the posting…";
    saveStatus.className = "";

    let job;
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectJob });
      job = result?.result;
    } catch {
      saveStatus.textContent = "This page does not allow scripts. Open the posting itself and try again.";
      saveStatus.className = "error";
      return;
    }

    if (!job?.title || (job.text ?? "").length < 40) {
      saveStatus.textContent = "No posting found on this page. Open the job description first.";
      saveStatus.className = "error";
      return;
    }

    try {
      const response = await fetch(`${API_ORIGIN}/api/jobs/capture`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-capture-token": token },
        body: JSON.stringify({
          url: job.url,
          title: job.title.slice(0, 200),
          company: job.company.slice(0, 120),
          location: job.location.slice(0, 160),
          text: (job.text ?? "").slice(0, 13000),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        saveStatus.textContent = payload.error === "unknown token" ? "That token is not recognised. Copy it again from /jobs." : "Could not save this job.";
        saveStatus.className = "error";
        return;
      }
      await chrome.storage.local.set({ captureToken: token });
      saveStatus.textContent = payload.duplicate ? "Already in your list." : "Saved. Open /jobs to see its match score.";
      saveStatus.className = "";
    } catch {
      saveStatus.textContent = "Could not reach jobautomation. Is the app running on localhost:3001?";
      saveStatus.className = "error";
    }
  });
}


/**
 * Finds hiring posts already visible on the page.
 *
 * Only what is rendered right now: no scrolling, no pagination, no background
 * requests. The candidate ticks what to keep, so nothing is added silently.
 */
function findHiringPosts() {
  const HIRING = /\b(hiring|we[’']?re hiring|we are hiring|job opening|open role|looking for|vacancy)\b/i;
  const seen = new Set();
  const found = [];

  const candidates = [
    ...document.querySelectorAll("article, li, [data-testid='tweet'], .feed-shared-update-v2, .job-card-container, .jobs-search-results__list-item"),
  ];

  for (const element of candidates) {
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 80 || text.length > 4000) continue;
    if (!HIRING.test(text)) continue;

    const link = element.querySelector("a[href*='/jobs/view/'], a[href*='/status/'], a[href^='/feed/update/']");
    const url = link?.href ?? location.href;
    if (seen.has(url)) continue;
    seen.add(url);

    const heading = (element.querySelector("h1, h2, h3, strong")?.textContent ?? text.slice(0, 90)).replace(/\s+/g, " ").trim();
    const company = (element.querySelector("a[href^='/company/'], a[href*='/in/']")?.textContent ?? "").replace(/\s+/g, " ").trim();

    found.push({ url, title: heading.slice(0, 160), company: company.slice(0, 100), text: text.slice(0, 4000) });
    if (found.length >= 12) break;
  }

  return found;
}
