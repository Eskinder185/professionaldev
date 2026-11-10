/** Shared regular expressions and small text helpers for résumé parsing. */

export const BULLET_RE = /^\s*(?:[•●▪◦‣∙·■□➢➤►»✓✔*]|[-–—](?=\s)|o(?=\s)|\d{1,2}[.)](?=\s))\s*/;

export const isBullet = (line: string) => BULLET_RE.test(line) && line.replace(BULLET_RE, "").trim().length > 0;
export const stripBullet = (line: string) => line.replace(BULLET_RE, "").trim();

const MONTH = "\\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const SEASON = "\\b(?:Spring|Summer|Fall|Autumn|Winter)";
const DATE = `(?:(?:${MONTH}|${SEASON}),?\\s+(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])\\/(?:19|20)?\\d{2}|(?:19|20)\\d{2})`;
const END = `(?:${DATE}|Present|Current|Now|Ongoing|Today)`;
const RANGE_RE = new RegExp(`(${DATE})\\s*(?:-|–|—|to|until|through)\\s*(${END})`, "i");
const SINGLE_RE = new RegExp(`(?:(?:Expected|Anticipated|Graduated|Graduation|Issued|Completed)[:\\s]+)?(?:${MONTH}|${SEASON}),?\\s+(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])\\/(?:19|20)\\d{2}`, "i");
const YEAR_END_RE = /(?:^|[\s,|(–—-])((?:Expected\s+)?(?:19|20)\d{2})\)?\s*$/i;

export type DateMatch = { start: string; end: string; current: boolean; single: boolean; rest: string };

const cleanRest = (text: string) =>
  text
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s|,–—\-·•:]+|[\s|,–—\-·•:(]+$/g, "")
    .trim();

/** Find a date range (or a single date) in a line and return the remaining text. */
export function findDates(line: string): DateMatch | null {
  const range = line.match(RANGE_RE);
  if (range && range.index !== undefined) {
    const end = range[2];
    const current = /present|current|now|ongoing|today/i.test(end);
    const rest = line.slice(0, range.index) + "  " + line.slice(range.index + range[0].length);
    return { start: range[1].trim(), end: current ? "Present" : end.trim(), current, single: false, rest: cleanRest(rest) };
  }
  const single = line.match(SINGLE_RE);
  if (single && single.index !== undefined) {
    const rest = line.slice(0, single.index) + "  " + line.slice(single.index + single[0].length);
    return { start: "", end: single[0].trim(), current: false, single: true, rest: cleanRest(rest) };
  }
  const year = line.match(YEAR_END_RE);
  if (year && year.index !== undefined) {
    const before = line.slice(0, year.index + year[0].indexOf(year[1]));
    return { start: "", end: year[1].trim(), current: false, single: true, rest: cleanRest(before) };
  }
  return null;
}

export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
export const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
export const URL_RE = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|dev|net|org|me|app|co|ai|edu|tech|site|page|xyz|us|info)(?:\/[^\s|,]*)?/i;
export const LOCATION_RE = /^(?:(?:[A-Z][a-zA-Z.'-]*\s?){1,3},\s*(?:[A-Z]{2}|[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)(?:\s+\d{5})?|Remote|Hybrid|On-?site)$/;
export const LOCATION_TAIL_RE = /(?:^|,\s*|\s{2,}|\s[|–—-]\s)((?:[A-Z][a-zA-Z.'-]*\s?){1,3},\s*[A-Z]{2}|Remote|Hybrid)\s*$/;

export const ROLE_RE = /\b(?:engineer|developer|programmer|analyst|manager|intern|internship|specialist|technician|administrator|consultant|designer|lead|director|assistant|associate|scientist|architect|coordinator|officer|representative|supervisor|tutor|teacher|instructor|researcher|fellow|volunteer|president|founder|co-founder|head of|vp|owner|accountant|clerk|cashier|agent|advisor|adviser|strategist|editor|writer|operator|sre|devops|tester|qa|apprentice|trainee|member)\b/i;
export const ORG_RE = /\b(?:Inc|LLC|L\.L\.C|Corp|Corporation|Company|Co\.|Ltd|Limited|Group|University|College|Agency|Department|Dept|Bank|Labs?|Technologies|Technology|Systems|Solutions|Services|Hospital|Institute|Foundation|Association|Partners|Consulting|Studios?|Ventures|Health|Federal|County|City of|Government|Center|Centre)\b/;
export const INSTITUTION_RE = /\b(?:University|College|Institute|School|Academy|Polytechnic|Conservatory|Bootcamp|Universidad|Université)\b/i;
export const DEGREE_RE = /\b(?:Bachelor(?:'s)?|Master(?:'s)?|Associate(?:'s)?|Doctor(?:ate)?|Ph\.?\s?D\.?|MBA|B\.?S\.?c?|B\.?A\.?|M\.?S\.?c?|M\.?A\.?|B\.?Eng|M\.?Eng|A\.?A\.?S\.?|A\.?S\.?|Diploma|GED|High School)\b/;
export const GPA_RE = /\bGPA[:\s]*([0-4](?:\.\d{1,2})?(?:\s*\/\s*[0-9.]+)?)/i;

/** Split a header line into logical segments on common separators. */
export function splitSegments(line: string): string[] {
  return line
    .split(/\s*(?:\||\t+|\s{3,}|\s[–—]\s|\s-\s|\s·\s|\s•\s)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Split a comma/semicolon list without breaking text inside parentheses. */
export function splitList(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;|•·]/.test(char)) {
      out.push(current);
      current = "";
    } else current += char;
  }
  out.push(current);
  return out
    .map((item) => item.trim().replace(/^(?:and|&)\s+/i, "").replace(/[.\s]+$/, "").trim())
    .filter(Boolean);
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
export const isTerminated = (text: string) => /[.!?;:]["')\]]?$/.test(text.trim());
export const startsLowercase = (text: string) => /^[a-z(]/.test(text.trim());

export function normalizeUrl(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}
