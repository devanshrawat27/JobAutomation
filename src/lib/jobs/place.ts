/**
 * Reading where a job actually is.
 *
 * "Remote" is not one thing: remote worldwide, remote in India, and remote for
 * US residents only are three different offers to a candidate applying from
 * India. This module turns a posting's location line and opening paragraphs
 * into that distinction, so the score can stop rewarding a job the candidate
 * cannot take.
 */

export type Reach = {
  remote: boolean;
  hybrid: boolean;
  /** Explicitly limited to residents of one country or region. */
  restricted: boolean;
  restriction: string | null;
  worldwide: boolean;
  country: string | null;
  city: string | null;
};

const REMOTE = /\b(remote|work from home|wfh|distributed team|anywhere)\b/i;
const HYBRID = /\bhybrid\b/i;
const WORLDWIDE = /\b(anywhere|worldwide|global(ly)?|any country|international)\b/i;

const COUNTRIES = [
  "india", "united states", "usa", "us", "canada", "united kingdom", "uk", "ireland",
  "germany", "netherlands", "france", "spain", "poland", "portugal", "sweden", "switzerland",
  "israel", "singapore", "australia", "new zealand", "japan", "south korea", "uae", "dubai",
  "brazil", "mexico", "argentina", "south africa", "nigeria", "kenya", "indonesia", "vietnam",
  "philippines", "pakistan", "bangladesh", "sri lanka", "nepal",
];

const CITY_COUNTRY: Array<[RegExp, string]> = [
  [/\b(san francisco|new york|seattle|austin|boston|chicago|denver|atlanta|los angeles|bay area|palo alto|mountain view|menlo park|remote us)\b/i, "united states"],
  [/\b(london|manchester|edinburgh)\b/i, "united kingdom"],
  [/\b(dublin|cork|galway)\b/i, "ireland"],
  [/\b(toronto|vancouver|montreal|ottawa)\b/i, "canada"],
  [/\b(berlin|munich|hamburg)\b/i, "germany"],
  [/\b(amsterdam|rotterdam)\b/i, "netherlands"],
  [/\b(bengaluru|bangalore|mumbai|pune|delhi|gurugram|noida|hyderabad|chennai|kolkata)\b/i, "india"],
];

/** A two-letter state code after a comma: "Austin, TX". */
const US_STATE = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

const CITIES = [
  "bengaluru", "bangalore", "mumbai", "pune", "delhi", "new delhi", "gurugram", "gurgaon",
  "noida", "hyderabad", "chennai", "kolkata", "ahmedabad", "jaipur", "indore", "kochi",
  "coimbatore", "chandigarh", "lucknow", "nagpur", "remote",
];

/** "Remote (US only)", "must be based in Canada", "India residents only". */
const RESTRICTION_PATTERNS = [
  /\(([^)]{2,60})\)/g,
  /\b(?:must|need to|required to)\s+(?:be\s+)?(?:based|located|resident|live)\s+in\s+([a-z ,/&-]{2,40})/gi,
  /\b(?:only|solely)\s+(?:for\s+)?(?:candidates?|applicants?|residents?)\s+(?:based\s+)?in\s+([a-z ,/&-]{2,40})/gi,
  /\b([a-z ,/&-]{2,30})\s+(?:residents?|citizens?|work authorisation|work authorization)\s+only/gi,
  /\bauthori[sz]ed to work in\s+([a-z ,/&-]{2,40})/gi,
];

function countryIn(text: string): string | null {
  const lower = text.toLowerCase();
  for (const country of COUNTRIES) {
    if (new RegExp(`(^|[^a-z])${country}([^a-z]|$)`).test(lower)) return country;
  }
  return null;
}

function cityIn(text: string): string | null {
  const lower = text.toLowerCase();
  for (const city of CITIES) {
    if (lower.includes(city)) return city;
  }
  return null;
}

export function parseReach(location: string | null, title: string, description: string): Reach {
  const head = `${location ?? ""} ${title}`;
  const body = description.slice(0, 700);
  const text = `${head} ${body}`;

  const remote = REMOTE.test(head) || /\bremote\b/i.test(body);
  const hybrid = HYBRID.test(text);
  const worldwide = WORLDWIDE.test(head) || WORLDWIDE.test(body);

  let restriction: string | null = null;
  for (const pattern of RESTRICTION_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match) continue;
    const candidate = (match[1] ?? "").toLowerCase().trim();
    if (!candidate) continue;
    // "(Full-time)" and "(Remote)" are not restrictions.
    if (!/\b(only|residents?|citizens?|based|located|authori[sz]ed|work)\b/.test(candidate) && !countryIn(candidate)) {
      continue;
    }
    restriction = countryIn(candidate) ?? candidate.slice(0, 40);
    break;
  }

  // A country named in the location line is the posting's own country; failing
  // that, a known city or a two-letter US state gives it away.
  const cityCountry = CITY_COUNTRY.find(([pattern]) => pattern.test(location ?? ""))?.[1] ?? null;
  const stateCountry = US_STATE.test(location ?? "") ? "united states" : null;
  let country = countryIn(location ?? "") ?? cityCountry ?? stateCountry ?? null;
  const indiaHint =
    /\b(india|bengaluru|bangalore|mumbai|pune|delhi|gurugram|gurgaon|noida|hyderabad|chennai|kolkata|ahmedabad|jaipur|indore|kochi|coimbatore|chandigarh|lucknow|nagpur)\b/i.test(
      location ?? "",
    );
  if (!country && (location ?? "").trim() && !indiaHint && !remote) country = "elsewhere";
  if (!restriction && remote && country && !worldwide) restriction = country;

  return {
    remote,
    hybrid,
    restricted: Boolean(restriction) && !worldwide,
    restriction: nationwide(restriction),
    worldwide,
    country,
    city: cityIn(head) ?? cityIn(body),
  };
}

function nationwide(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\b(residents?|citizens?|only|based|located|must be)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s]+$/, "")
    .trim();
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (/^(ut|id|ca|ny|tx|wa)( or (ut|id|ca|ny|tx|wa))+$/.test(lower)) return "United States";
  if (/\b(india)\b/.test(lower)) return "India";
  if (/\b(united states|usa|us)\b/.test(lower)) return "United States";
  if (/\b(united kingdom|uk)\b/.test(lower)) return "United Kingdom";
  if (/\b(canada)\b/.test(lower)) return "Canada";
  return cleaned.slice(0, 40);
}

/** Where the candidate can actually work. India first, as the product is. */
export type CandidatePlace = { country: string; cities: string[]; remoteFriendly: boolean };

export function scoreReach(
  reach: Reach,
  place: CandidatePlace,
): { points: number; reason: string | null; blocked: boolean; foreign: boolean } {
  const homeCountry = place.country.toLowerCase();
  const restrictedToHome = reach.restricted && (reach.restriction ?? "").toLowerCase().includes(homeCountry);
  const restrictedElsewhere = reach.restricted && !restrictedToHome;

  if (restrictedElsewhere) {
    return {
      points: 0,
      reason: `Limited to ${reach.restriction} residents`,
      blocked: true,
      foreign: true,
    };
  }

  if (reach.city && place.cities.some((city) => reach.city!.includes(city) || city.includes(reach.city!))) {
    return { points: 10, reason: `In ${reach.city}`, blocked: false, foreign: false };
  }

  if (reach.remote && reach.worldwide) {
    return { points: 9, reason: "Remote, open worldwide", blocked: false, foreign: false };
  }

  if (reach.remote && restrictedToHome) {
    return { points: 9, reason: `Remote, for ${reach.restriction} residents`, blocked: false, foreign: false };
  }

  if (reach.remote && !reach.country) {
    return {
      points: place.remoteFriendly ? 8 : 6,
      reason: "Remote posting",
      blocked: false,
      foreign: false,
    };
  }

  if (reach.country && reach.country.toLowerCase().includes(homeCountry)) {
    return { points: 8, reason: `In ${reach.country}`, blocked: false, foreign: false };
  }

  if (reach.country) {
    return {
      points: 0,
      reason: `Based in ${reach.country}`,
      blocked: false,
      foreign: true,
    };
  }

  return { points: 3, reason: null, blocked: false, foreign: false };
}
