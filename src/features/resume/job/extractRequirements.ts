import { uid } from "../model/defaults";
import type { Requirement, RequirementKind } from "../model/types";
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
 * 6. Flag unknown acronyms in requirement lines as uncertain "Other technical terms".
 * 7. Merge duplicates by normalized term, keeping every original phrase and the
 *    strongest classification (required > preferred > responsibility > context).
 */

export type ExtractionResult = { requirements: Requirement[]; hasHeadings: boolean; lineCount: number };

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

const ACRONYM_STOP = new Set(["USA", "US", "EEO", "EOE", "LLC", "INC", "HR", "PTO", "FAQ", "CEO", "CTO", "CIO", "OK", "ID", "IT", "AM", "PM", "EST", "PST", "CST", "MST", "ET", "PT", "NA", "TBD", "ASAP", "FTE", "W2", "K12", "ADA", "DE&I", "DEI", "LGBTQ", "II", "III", "IV", "AI", "UI", "UX", "B2B", "B2C", "SAAS", "KPI", "KPIS", "ROI", "Q1", "Q2", "Q3", "Q4", "GPA", "BS", "BA", "MS", "MA", "MBA", "PHD", "GED", "OR", "AND", "THE", "CS", "STEM", "NYC", "SF", "LA", "DC", "NY", "TX", "CA", "WFH", "NOTE", "AWS"]);

const snippetOf = (line: string) => {
  const clean = line.replace(BULLET, "").replace(/\s+/g, " ").trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}…` : clean;
};

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function extractRequirements(description: string): ExtractionResult {
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
      if (snippet && !existing.snippets.includes(snippet) && existing.snippets.length < 3) existing.snippets.push(snippet);
      if (KIND_RANK[kind] > KIND_RANK[existing.kind]) existing.kind = kind;
      existing.selected = existing.kind !== "context";
      existing.uncertain = existing.uncertain && uncertain;
      return;
    }
    found.set(key, { id: uid(), term, phrases: [phrase], snippets: snippet ? [snippet] : [], category, kind, selected: kind !== "context", possession: "unanswered", origin: "detected", uncertain: uncertain || undefined });
  };

  let section: RequirementKind = hasHeadings ? "context" : "required";
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const heading = headingKind(raw);
    if (heading) {
      section = heading;
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
    if (kind === "required" || kind === "preferred") {
      for (const match of masked.matchAll(/(?<![A-Za-z0-9])([A-Z][A-Z0-9]{1,6}(?:\/[A-Z0-9]{2,6})?)(?![A-Za-z0-9])/g)) {
        const token = match[1];
        if (ACRONYM_STOP.has(token.toUpperCase()) || /^\d/.test(token)) continue;
        add(token, "Other technical terms", kind, token, raw, true);
      }
    }
  }

  const requirements = [...found.values()];
  return { requirements, hasHeadings, lineCount: lines.filter((line) => line.trim()).length };
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
