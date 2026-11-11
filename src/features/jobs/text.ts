import type { Salary, WorkArrangement } from "./schema";

/**
 * Turns untrusted posting HTML into plain text. The result is only ever rendered as text, and the
 * text is only ever treated as data: instructions inside a posting never reach an AI or the extension.
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  // Some feeds (Greenhouse) return entity-escaped HTML; decode once if it contains no real tags.
  let source = html;
  if (!/<[a-z][\s\S]*>/i.test(source) && /&lt;[a-z]/i.test(source)) source = decodeEntities(source);
  const doc = new DOMParser().parseFromString(source, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,noscript,template").forEach((n) => n.remove());
  doc.querySelectorAll("li").forEach((li) => li.insertBefore(doc.createTextNode("• "), li.firstChild));
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,ul,ol,tr").forEach((n) => n.append("\n"));
  return (doc.body.textContent ?? "")
    .replace(/\xA0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(s: string): string {
  const ta = new DOMParser().parseFromString(`<!doctype html><body>${s}`, "text/html");
  return ta.body.textContent ?? "";
}

const HEADINGS: Array<{ key: "about" | "responsibilities" | "requirements" | "benefits"; re: RegExp }> = [
  { key: "responsibilities", re: /^(?:key\s+)?(?:responsibilities|what you(?:'|’)ll do|what you will do|the role|your impact|in this role|duties|day[- ]to[- ]day)/i },
  { key: "requirements", re: /^(?:minimum\s+|basic\s+|preferred\s+|required\s+)?(?:qualifications|requirements|what you(?:'|’)ll bring|what you bring|who you are|skills|you have|what we(?:'|’)re looking for|about you|must have|nice to have|preferred)/i },
  { key: "benefits", re: /^(?:benefits|perks|what we offer|compensation (?:&|and) benefits|why join|total rewards|we offer)/i },
  { key: "about", re: /^(?:about (?:the )?(?:job|role|position|team|us|the company)|who we are|overview|company|summary)/i },
];

export interface Sections {
  about: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
}

const bullet = /^\s*(?:[•\-*▪●◦]|\d+[.)])\s+/;

/** Splits plain text by recognisable headings. Anything not under a known heading stays in `about`. */
export function splitSections(text: string): Sections {
  const out: Sections = { about: "", responsibilities: [], requirements: [], benefits: [] };
  let current: keyof Sections = "about";
  const aboutLines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const plain = line.replace(/[:：]\s*$/, "").replace(bullet, "").trim();
    const isHeading = !bullet.test(line) && plain.length <= 70 && !/[.!?]$/.test(plain) || /[:：]\s*$/.test(line) && plain.length <= 70;
    const hit = isHeading ? HEADINGS.find((h) => h.re.test(plain)) : undefined;
    if (hit) {
      current = hit.key;
      continue;
    }
    if (current === "about") aboutLines.push(line.replace(bullet, ""));
    else out[current].push(line.replace(bullet, "").trim());
  }
  out.about = aboutLines.join("\n").trim();
  return out;
}

export function detectArrangement(...parts: Array<string | null | undefined>): WorkArrangement {
  const t = parts.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\b(remote|work from home|telecommute|distributed)\b/.test(t)) return "remote";
  if (/\b(on[- ]?site|in[- ]office|in[- ]person)\b/.test(t)) return "onsite";
  return "unspecified";
}

const MONEY = /([$€£])\s?(\d{2,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK])\s*(?:-|–|—|to)\s*(?:[$€£]\s?)?(\d{2,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK])(?:\s*(?:\/|per\s)\s*(year|yr|hour|hr|annum|month|week|day))?/i;
const num = (s: string): number => {
  const k = /k$/i.test(s.trim());
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return k ? n * 1000 : n;
};

/** Salary only from explicit published text, never estimated. */
export function extractSalary(text: string): Salary | null {
  const m = text.match(MONEY);
  if (!m) return null;
  const currency = m[1] === "€" ? "EUR" : m[1] === "£" ? "GBP" : "USD";
  const unit = (m[4] ?? "").toLowerCase();
  const period = unit.startsWith("h") ? "hour" : unit.startsWith("m") ? "month" : unit.startsWith("w") ? "week" : unit.startsWith("d") ? "day" : unit ? "year" : null;
  return { min: num(m[2]), max: num(m[3]), currency, period, text: m[0].trim() };
}

export function formatSalary(s: Salary | null): string | null {
  if (!s) return null;
  if (s.text) return s.text;
  const sym = s.currency === "EUR" ? "€" : s.currency === "GBP" ? "£" : "$";
  const f = (n: number) => `${sym}${Math.round(n).toLocaleString("en-US")}`;
  const range = s.min && s.max && s.min !== s.max ? `${f(s.min)}–${f(s.max)}` : f((s.min ?? s.max) as number);
  return s.period ? `${range} / ${s.period}` : range;
}

/** "Requirements at a glance": each item appears only when the posting says it. */
export interface Glance {
  experience: string | null;
  experienceLevel: "entry" | "mid" | "senior" | null;
  education: string | null;
  certifications: string[];
  workAuthorization: string | null;
  other: string[];
}

const CERTS = /\b(CompTIA\s+(?:A\+|Network\+|Security\+|Linux\+|Cloud\+|CySA\+)|A\+|Network\+|Security\+|CCNA|CCNP|CISSP|CISM|CEH|AWS Certified[\w\s-]*|Azure[\w\s-]*Certif\w*|Google Cloud[\w\s-]*Certif\w*|RHCSA|RHCE|CKA|CKAD|PMP|ITIL|Terraform Associate)(?!\w)/gi;

export function extractGlance(posting: { title: string; description: string; requirements: string[] }): Glance {
  const text = [posting.title, posting.requirements.join("\n"), posting.description].join("\n");
  const years = text.match(/(\d{1,2})\s*(?:\+|\s*-\s*\d{1,2}\s*)?\s*(?:years?|yrs?)\b[^.\n]{0,60}?experience/i) ?? text.match(/(?:minimum|at least)\s+(\d{1,2})\s*(?:years?|yrs?)/i);
  const n = years ? Number(years[1]) : null;
  const titleLevel = /\b(senior|sr\.?|staff|principal|lead)\b/i.test(posting.title) ? "senior" : /\b(junior|jr\.?|entry|associate|intern|graduate|new grad|i\b)\b/i.test(posting.title) ? "entry" : null;
  const level = n != null ? (n <= 2 ? "entry" : n <= 5 ? "mid" : "senior") : titleLevel;
  const edu = text.match(/\b((?:bachelor|master|associate|ph\.?d|doctorate)(?:'s|’s)?(?:\s+degree)?(?:\s+in\s+[A-Za-z ,/&-]{3,50}?)?(?=[.,;\n]|\s+or\b|\s+and\b|$)|high school diploma|GED)/i);
  const certs = Array.from(new Set((text.match(CERTS) ?? []).map((c) => c.trim())));
  const auth = text.match(/[^.\n]*\b(?:authorized to work|work authorization|right to work|visa sponsorship|sponsorship|security clearance|U\.?S\.? citizen(?:ship)?)\b[^.\n]*/i);
  const other: string[] = [];
  if (/\bsecurity clearance\b/i.test(text)) other.push("Security clearance mentioned");
  if (/\b(?:valid )?driver(?:'|’)?s licen[cs]e\b/i.test(text)) other.push("Driver’s license mentioned");
  if (/\bon[- ]call\b/i.test(text)) other.push("On-call duty mentioned");
  if (/\bwillingness to travel|travel (?:up to|required)|\d+%\s*travel/i.test(text)) other.push("Travel mentioned");
  return {
    experience: years ? years[0].replace(/\s+/g, " ").trim() : null,
    experienceLevel: level,
    education: edu ? edu[1].replace(/\s+/g, " ").trim() : null,
    certifications: certs,
    workAuthorization: auth ? auth[0].replace(/\s+/g, " ").trim().slice(0, 200) : null,
    other,
  };
}
