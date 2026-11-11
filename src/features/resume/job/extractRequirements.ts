import { uid } from "../model/defaults";
import type { JobMetadata, Requirement, RequirementKind } from "../model/types";
import { TAXONOMY, WEAK_ALIASES, termRegex } from "./taxonomy";

/**
 * Rule-based job-description requirement extraction. No network or AI calls.
 *
 * 1. Split the description into lines and detect section headings
 *    (Requirements, Preferred, Responsibilities, About/Benefits).
 * 2. Classify each line: heading context, overridden by inline cues such as
 *    "required", "must", "preferred", "nice to have", "a plus".
 * 3. Match the curated taxonomy (longest phrase first; matched text is consumed).
 * 4. Detect education and years-of-experience requirements with patterns.
 * 5. Treat lines under a responsibilities heading as responsibilities.
 * 6. Flag unknown acronyms in requirement lines as uncertain "Other technical terms",
 *    while filtering out locations, US state codes, salary units, company names, and
 *    generic uppercase words so they are never misclassified as job qualifications.
 * 7. Merge duplicates by normalized term, keeping every original phrase and the
 *    strongest classification (required > preferred > responsibility > context).
 */

export type ExtractionResult = {
  requirements: Requirement[];
  metadata: JobMetadata;
  hasHeadings: boolean;
  lineCount: number;
};

const KIND_RANK: Record<RequirementKind, number> = { required: 4, preferred: 3, responsibility: 2, context: 1 };

const HEADINGS: Array<[RequirementKind, RegExp]> = [
  ["preferred", /^(preferred|desired|bonus|nice[- ]to[- ]haves?|pluses|additional|extra credit|it'?s a plus|good to have)\b/],
  ["required", /^(requirements?|required|minimum|basic|must[- ]haves?|qualifications|what you('ll)? (need|bring)|who you are|skills( and| &) (experience|qualifications)|you have|what we('re)? looking for|key skills|essential)\b/],
  ["responsibility", /^(responsibilities|key responsibilities|duties|job duties|what you('ll)? do|the role|role overview|day[- ]to[- ]day|in this role|your impact|essential functions|what you will do)\b/],
  ["context", /^(about( us| the (company|team|role))?|who we are|benefits|perks|compensation|salary|pay range|equal opportunity|eeo|our (mission|values|culture)|why join|location|overview|summary|job summary|position summary)\b/],
];

const PREFERRED_CUE = /\b(preferred|nice to have|is a plus|are a plus|a plus|bonus|desirable|ideally|advantageous|familiarity with|exposure to)\b/i;
const REQUIRED_CUE = /\b(required|must|minimum|at least|need to have|essential|mandatory)\b/i;
const RESPONSIBILITY_CUE = /^\s*(you will|you'll|you’ll|in this role you|responsibilities include|duties include)\b/i;
const BULLET = /^\s*(?:[•●▪◦‣∙·*■➢►-]|\d{1,2}[.)])\s+/;

function headingKind(line: string): RequirementKind | null {
  const trimmed = line.trim().replace(/[:\s]+$/, "");
  if (!trimmed || trimmed.split(/\s+/).length > 7 || BULLET.test(line) || /[.!?]$/.test(trimmed)) return null;
  const normalized = trimmed.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z' &-]/g, " ").replace(/\s+/g, " ").trim();
  for (const [kind, pattern] of HEADINGS) if (pattern.test(normalized)) return kind;
  return null;
}

type Matcher = { term: string; category: string; alias: string; weak: boolean; re: RegExp };

function buildMatchers(): Matcher[] {
  const matchers: Matcher[] = [];
  for (const [category, entries] of Object.entries(TAXONOMY))
    for (const [term, aliases = []] of entries)
      for (const alias of [term, ...aliases]) matchers.push({ term, category, alias, weak: WEAK_ALIASES.has(alias), re: termRegex(alias, "g") });
  // Longest aliases first so specific phrases win over generic ones.
  return matchers.sort((a, b) => b.alias.length - a.alias.length);
}

let cachedMatchers: Matcher[] | null = null;
const matchers = () => (cachedMatchers ??= buildMatchers());

const STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "ON", "BC", "AB", "QC",
];

const CITY_STATE_RE = new RegExp(
  `\\b([A-Z][A-Za-z .'-]{1,28}),\\s*(${STATE_CODES.join("|")})\\b(?:\\s+\\d{5}(?:-\\d{4})?)?`,
  "g",
);

const SALARY_RE =
  /(?:\$\s?\d[\d,.]*(?:\s?[kKmM])?(?:\s*(?:-|–|to)\s*\$?\s?\d[\d,.]*(?:\s?[kKmM])?)?(?:\s*(?:\/|\bper\s+)\s*(?:yr|yrs|year|years|hr|hrs|hour|hours|mo|month|wk|week|annum))?|\b\d[\d,.]*\s*(?:USD|CAD|EUR|GBP)(?:\s*(?:\/|\bper\s+)\s*(?:yr|year|hr|hour|mo|month))?)/gi;

const COMPANY_SUFFIX_RE =
  /\b([A-Z][A-Za-z0-9& .'-]{1,40}\s+(?:LLC|Inc\.?|Corp\.?|Corporation|Ltd\.?|LLP|PLC|Company|Co\.?))\b/g;

const ACRONYM_STOP = new Set([
  ...STATE_CODES,
  "USA", "US", "UK", "EU", "CANADA",
  "EEO", "EOE", "LLC", "INC", "CORP", "LTD", "PLC", "LLP", "DBA",
  "HR", "HRS", "YR", "YRS", "MO", "MOS", "WK", "WKS", "USD", "CAD", "EUR", "GBP",
  "OTE", "RSU", "RSUS", "APR", "BASE", "PAY", "COMP", "BONUS", "LBS", "LB", "FT", "SQ", "MPH", "KWH", "MW", "GW",
  "PTO", "VTO", "FAQ", "CEO", "CTO", "CIO", "CFO", "COO", "VP", "SVP", "EVP", "GM", "PM", "AM",
  "OK", "ID", "IT", "EST", "PST", "CST", "MST", "ET", "PT", "CT", "MT", "UTC", "GMT",
  "NA", "TBD", "TBA", "ASAP", "FTE", "W2", "1099", "C2C", "K12", "ADA", "FMLA", "COBRA", "HSA", "FSA", "NDA", "NDAS",
  "DE&I", "DEI", "LGBTQ", "BIPOC", "ERG", "ERGS",
  "II", "III", "IV", "VI", "VII", "VIII", "IX",
  "AI", "UI", "UX", "B2B", "B2C", "SAAS", "KPI", "KPIS", "ROI", "OKR", "OKRS",
  "Q1", "Q2", "Q3", "Q4", "H1", "H2", "FY", "YOY",
  "GPA", "BS", "BA", "MS", "MA", "MBA", "PHD", "GED", "AS", "AAS", "BENG", "MENG",
  "OR", "AND", "THE", "CS", "STEM", "WFH", "RTO", "NOTE", "AWS", "PPE",
  // Major US/Global city & airport codes often used in data center / IT job postings
  "ATL", "NYC", "SFO", "SF", "LAX", "ORD", "DFW", "SEA", "BOS", "DEN", "IAD", "DCA", "AUS", "PHX", "CLT", "RDU", "BWI", "MCO", "MIA", "IAH", "MSP", "DTW", "PHL", "LGA", "JFK", "EWR", "CMH", "PDX", "SLC",
  // Common uppercase words in postings
  "MUST", "HAVE", "NEED", "WORK", "TEAM", "TEAMS", "ROLE", "ROLES", "FULL", "PART", "TIME", "SHIFT", "SHIFTS",
  "ABLE", "LIFT", "PASS", "DRUG", "TEST", "ONLY", "WITH", "FROM", "THIS", "THAT", "YOUR", "WILL", "HIGH", "LOW",
  "PLUS", "REQUIRED", "PREFERRED", "MINIMUM", "BASIC", "ABOUT", "JOIN", "APPLY", "REMOTE", "HYBRID", "ONSITE",
  "ALL", "ANY", "ARE", "NOT", "FOR", "YOU", "OUR", "WHO", "WHAT", "WHY", "HOW", "NEW", "NOW",
  "DAY", "DAYS", "NIGHT", "WEEK", "WEEKS", "YEAR", "YEARS", "MONTH", "HOUR", "HOURS",
  "JOB", "JOBS", "CAREER", "LEVEL", "TIER", "STEP", "SITE", "SITES", "CITY", "STATE", "AREA", "ZONE", "ROOM", "FLOOR", "HALL",
  "EAST", "WEST", "NORTH", "SOUTH", "NON", "PRE", "POST", "PRO", "SUB", "TOP", "END",
  "USE", "USED", "USING", "MAKE", "MADE", "KEEP", "HELP", "LEAD", "RUN", "SET", "GET", "PUT", "TAKE", "GIVE", "MEET",
  "OPEN", "CLOSE", "NEXT", "BEST", "GOOD", "FAST", "SAFE", "SELF", "BOTH", "EACH", "MORE", "MOST", "LESS", "SOME", "SUCH",
  "SAME", "VERY", "WELL", "ALSO", "BACK", "OVER", "INTO", "UPON", "PER", "VIA", "ETC", "YES", "NO", "ON", "IN", "AT", "TO", "BY", "OF", "AS", "IS", "BE", "DO", "GO", "SO", "UP", "IF",
]);

/** Extract non-qualification metadata (company, location, work mode, compensation, employment type). */
export function extractJobMetadata(description: string): JobMetadata {
  const metadata: JobMetadata = {};
  const clean = description.replace(/\r\n?/g, "\n");

  const labelCompany = clean.match(/(?:^|\n)\s*(?:company|employer|organization)\s*:\s*([^\n|•]{2,120})/i);
  const suffixCompany = clean.match(/\b([A-Z][A-Za-z0-9& .'-]{1,45}\s+(?:LLC|Inc\.?|Corp\.?|Corporation|Ltd\.?))\b/);
  const seekingCompany = clean.match(/(?:^|\n)\s*([A-Z][A-Za-z0-9& .'-]{1,45}?)\s+is\s+(?:seeking|hiring|looking\s+for)\b/);
  const company = (labelCompany?.[1] || suffixCompany?.[1] || seekingCompany?.[1] || "").trim();
  if (company && !/^(location|role|title|position|summary|about|we|our|the)\b/i.test(company)) {
    metadata.company = company.replace(/[.,;]+$/, "");
  }

  const labelLoc = clean.match(/(?:^|\n)\s*location\s*:\s*([^\n|•]{2,120})/i);
  const cityState = clean.match(new RegExp(`\\b([A-Z][A-Za-z .'-]{1,28},\\s*(?:${STATE_CODES.join("|")}))\\b(?:\\s+\\d{5}(?:-\\d{4})?)?`));
  if (labelLoc?.[1]) metadata.location = labelLoc[1].trim().replace(/[.,;]+$/, "");
  else if (cityState?.[1]) metadata.location = cityState[1].trim();

  if (/\bhybrid\b/i.test(clean)) metadata.workMode = "Hybrid";
  else if (/\b(?:fully\s+remote|100%\s+remote|work\s+from\s+home|remote(?:\s+role|\s+position|\s+work)?)\b/i.test(clean) && !/\bno\s+remote\b|\bnot\s+remote\b/i.test(clean)) metadata.workMode = "Remote";
  else if (/\b(?:on[- ]site|onsite|in[- ]person|in[- ]office)\b/i.test(clean)) metadata.workMode = "On-site";

  const salaryMatch = clean.match(SALARY_RE);
  if (salaryMatch?.[0]) metadata.compensation = salaryMatch[0].trim();

  if (/\bfull[- ]time\b/i.test(clean)) metadata.employmentType = "Full-time";
  else if (/\bpart[- ]time\b/i.test(clean)) metadata.employmentType = "Part-time";
  else if (/\bcontract(?:-to-hire|\s+role|\s+position)?\b/i.test(clean)) metadata.employmentType = "Contract";
  else if (/\binternship|\bintern\b/i.test(clean)) metadata.employmentType = "Internship";

  return metadata;
}

/** A line that is mostly capital letters ("NOW HIRING", a banner) says nothing about acronyms. */
const isShouting = (line: string) => {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length >= 8 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6;
};

const snippetOf = (line: string) => {
  const clean = line.replace(BULLET, "").replace(/\s+/g, " ").trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}…` : clean;
};

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function extractRequirements(description: string): ExtractionResult {
  const metadata = extractJobMetadata(description);
  const companyTokens = new Set(
    (metadata.company ?? "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((t) => t.length >= 2),
  );
  const locationTokens = new Set(
    (metadata.location ?? "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((t) => t.length >= 2),
  );

  // Classify sentence by sentence so "must have X. Y is a plus." gets two different kinds.
  const lines = description
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?;])\s+(?=[A-Z])/));
  const hasHeadings = lines.some((line) => headingKind(line) !== null);
  const found = new Map<string, Requirement>();

  const add = (term: string, category: string, kind: RequirementKind, phrase: string, line: string, uncertain = false) => {
    const key = term.toLowerCase();
    const snippet = snippetOf(line);
    const existing = found.get(key);
    if (existing) {
      if (!existing.phrases.includes(phrase)) existing.phrases.push(phrase);
      if (snippet && !existing.snippets.includes(snippet) && existing.snippets.length < 3) {
        existing.snippets.push(snippet);
        existing.snippetKinds?.push(kind);
      }
      if (KIND_RANK[kind] > KIND_RANK[existing.kind]) existing.kind = kind;
      existing.selected = existing.kind !== "context";
      existing.uncertain = existing.uncertain && uncertain;
      return;
    }
    found.set(key, { id: uid(), term, phrases: [phrase], snippets: snippet ? [snippet] : [], snippetKinds: snippet ? [kind] : [], category, kind, selected: kind !== "context", possession: "unanswered", origin: "detected", uncertain: uncertain || undefined });
  };

  let section: RequirementKind = hasHeadings ? "context" : "required";
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const heading = headingKind(raw);
    if (heading) {
      section = heading;
      continue;
    }
    // Skip pure metadata lines (Location: ..., Salary: ..., Pay: ..., Company: ...)
    if (/^\s*(?:location|salary|pay(?:\s+range)?|compensation|company|employer|job\s+type|work\s+location|schedule)\s*:/i.test(raw)) {
      continue;
    }
    let kind: RequirementKind = section;
    if (!hasHeadings && RESPONSIBILITY_CUE.test(raw)) kind = "responsibility";
    if (PREFERRED_CUE.test(raw)) kind = "preferred";
    else if (REQUIRED_CUE.test(raw) && section !== "responsibility") kind = "required";

    // Education requirements.
    const degree = raw.match(/\b(bachelor(?:'?s)?|associate(?:'?s)?|master(?:'?s)?|doctorate|ph\.?d\.?|high school diploma|GED|B\.S\.|B\.A\.|BS|BA|MS)\b(?:\s+degree)?[^.;\n]{0,90}/i);
    if (degree && /degree|diploma|GED|in\s+[A-Z]|equivalent/i.test(degree[0])) {
      const level = degree[1].toLowerCase();
      const name = /bachelor|b\.s|b\.a|^bs$|^ba$/.test(level) ? "Bachelor's degree" : /associate/.test(level) ? "Associate degree" : /master|^ms$/.test(level) ? "Master's degree" : /doctor|ph/.test(level) ? "Doctoral degree" : "High school diploma or GED";
      const field = degree[0].match(/\bin\s+([A-Z][A-Za-z&,/ ]{2,60}?)(?:\s+or\s+(?:a\s+)?related|\s*,|\s+or\b|$)/);
      add(field ? `${name} in ${field[1].trim()}` : name, "Education", /equivalent experience/i.test(raw) && kind === "required" ? "required" : kind, degree[0].trim(), raw);
    }

    // Years of experience.
    for (const match of raw.matchAll(/(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*(\d{1,2})\s*)?(?:years?|yrs?)(?:['’]s?)?\s+(?:of\s+)?(?:professional\s+|relevant\s+|hands-on\s+|related\s+|direct\s+)?(?:work\s+)?(?:experience\s+)?(?:(?:in|with|of|working (?:in|with)|supporting|as an?)\s+)?([^.;,()\n]{3,70})?/gi)) {
      const years = match[2] ? `${match[1]}–${match[2]}` : `${match[1]}+`;
      const area = (match[3] || "").replace(/\b(experience|required|preferred|or more|and|is|a plus)\b.*$/i, "").trim();
      add(area ? `${years} years: ${area}` : `${years} years of experience`, "Experience", kind, match[0].trim(), raw);
    }

    // Taxonomy terms, longest first; matched spans are masked so they are not double counted.
    let masked = raw;
    for (const matcher of matchers()) {
      matcher.re.lastIndex = 0;
      if (!matcher.re.test(masked)) continue;
      if (matcher.weak && kind === "context") continue;
      matcher.re.lastIndex = 0;
      masked = masked.replace(matcher.re, (text) => {
        add(matcher.term, matcher.category, kind, text, raw);
        return " ".repeat(text.length);
      });
    }

    // Responsibility lines.
    if (section === "responsibility" && raw.replace(BULLET, "").trim().split(/\s+/).length >= 4) {
      const text = sentenceCase(raw.replace(BULLET, "").trim().replace(/[.;]+$/, ""));
      add(text.length > 110 ? `${text.slice(0, 107)}…` : text, "Responsibilities", "responsibility", text, raw);
    }

    // Unknown acronyms in requirement lines are surfaced, flagged as uncertain.
    // Strip locations, salary strings, and company names first so they are never treated as skills.
    if ((kind === "required" || kind === "preferred") && !isShouting(masked)) {
      const cleanedForAcronyms = masked
        .replace(CITY_STATE_RE, " ")
        .replace(SALARY_RE, " ")
        .replace(COMPANY_SUFFIX_RE, " ");
      for (const match of cleanedForAcronyms.matchAll(/(?<![A-Za-z0-9])([A-Z][A-Z0-9]{1,6}(?:\/[A-Z0-9]{2,6})?)(?![A-Za-z0-9])/g)) {
        const token = match[1];
        const upper = token.toUpperCase();
        if (
          ACRONYM_STOP.has(upper) ||
          companyTokens.has(upper) ||
          locationTokens.has(upper) ||
          /^\d/.test(token)
        ) {
          continue;
        }
        add(token, "Other technical terms", kind, token, raw, true);
      }
    }
  }

  const requirements = [...found.values()];
  return { requirements, metadata, hasHeadings, lineCount: lines.filter((line) => line.trim()).length };
}

/** Categories in a stable, readable order: as first seen, Responsibilities and uncertain terms last. */
export function groupByCategory(requirements: Requirement[]): Array<{ category: string; items: Requirement[] }> {
  const groups = new Map<string, Requirement[]>();
  for (const requirement of requirements) {
    const list = groups.get(requirement.category) ?? [];
    list.push(requirement);
    groups.set(requirement.category, list);
  }
  const tail = ["Responsibilities", "Other technical terms"];
  return [...groups.entries()]
    .sort(([a], [b]) => (tail.indexOf(a) - tail.indexOf(b)) || 0)
    .map(([category, items]) => ({ category, items }));
}
