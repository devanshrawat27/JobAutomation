import { findLookalikeWords } from "@/lib/jobs/html";

/**
 * Fake, fee-charging and ghost postings.
 *
 * A posting that asks for money, promises pay for data entry, or lives on a
 * link shortener is not a job a candidate should spend an evening on. This is a
 * screen, not a verdict: every flag is shown with the sentence that caused it,
 * and the candidate decides.
 */

export type TrustFlag = {
  label: string;
  detail: string;
  weight: 1 | 2 | 3;
};

export type TrustResult = {
  risk: "low" | "medium" | "high";
  flags: TrustFlag[];
};

const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "lnkd.in", "rb.gy", "shorturl.at", "t.me"]);

export function assessPosting(posting: {
  title: string;
  url: string;
  company: string;
  description: string;
}): TrustResult {
  const text = `${posting.title}\n${posting.description}`.replace(/\s+/g, " ");
  const flags: TrustFlag[] = [];

  const fee = text.match(
    /\b(registration|security|training|refundable|onboarding)\s*(fee|deposit|charges|amount)\b[^.]{0,80}/i,
  );
  if (fee) {
    flags.push({
      label: "Asks for money",
      detail: `"${fee[0].trim().slice(0, 90)}" — charging candidates is the clearest scam signal.`,
      weight: 3,
    });
  }

  const payToApply = text.match(/\bpay\s*(?:₹|rs\.?|inr)\s*[0-9,]{2,6}\b[^.]{0,60}/i);
  if (payToApply) {
    flags.push({
      label: "Payment mentioned",
      detail: `"${payToApply[0].trim().slice(0, 90)}" — a real employer does not charge an applicant.`,
      weight: 3,
    });
  }

  if (/\b(data entry|typing job|copy paste job|form filling job|ad posting job)\b/i.test(text)) {
    flags.push({
      label: "Data-entry pattern",
      detail: "Postings that promise pay for typing or form filling are almost always fee scams.",
      weight: 3,
    });
  }

  if (/\bearn\s*(?:₹|rs\.?|inr)?\s*[0-9,]{3,6}\s*(?:per|\/)\s*(day|hour|daily)\b/i.test(text)) {
    flags.push({
      label: "Earnings promise",
      detail: "A daily earning figure in the posting, not a stipend or salary.",
      weight: 2,
    });
  }

  const whatsappOnly = /\b(whatsapp|telegram)\b/i.test(text) && !/\b(careers|apply|application form|job portal)\b/i.test(text);
  if (whatsappOnly) {
    flags.push({
      label: "Only a chat contact",
      detail: "The only way to apply is a chat link, with no careers page or form.",
      weight: 2,
    });
  }

  try {
    const host = new URL(posting.url).hostname.replace(/^www\./, "").toLowerCase();
    if (SHORTENERS.has(host)) {
      flags.push({
        label: "Shortened link",
        detail: `The posting points at ${host}, which hides where the application really goes.`,
        weight: 2,
      });
    }
  } catch {
    flags.push({ label: "Broken link", detail: "The posting URL does not parse.", weight: 2 });
  }

  const stipend = text.match(/(?:stipend|salary|ctc)[^.]{0,40}?(?:₹|rs\.?|inr)\s*([0-9,]{4,8})/i);
  if (stipend) {
    const amount = Number(stipend[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount >= 100_000 && /month|per month|\/month/i.test(stipend[0])) {
      flags.push({
        label: "Implausible pay",
        detail: `₹${stipend[1]} a month for this role is far outside the market.`,
        weight: 2,
      });
    }
  }

  if (posting.company.trim().length < 3 || /^(hiring|company|confidential)$/i.test(posting.company.trim())) {
    flags.push({
      label: "No employer named",
      detail: "The posting does not name who is hiring.",
      weight: 1,
    });
  }

  const lookalike = findLookalikeWords(text.slice(0, 4000));
  if (lookalike.length > 0) {
    flags.push({
      label: "Lookalike characters",
      detail: `Hidden characters or mixed scripts near: ${lookalike.slice(0, 3).join(", ")}`,
      weight: 1,
    });
  }

  const total = flags.reduce((sum, flag) => sum + flag.weight, 0);
  return {
    risk: total >= 3 ? "high" : total >= 2 ? "medium" : flags.length > 0 ? "low" : "low",
    flags,
  };
}
