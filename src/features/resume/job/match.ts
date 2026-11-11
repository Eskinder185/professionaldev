import type { DocumentSettings, Requirement, Resume } from "../model/types";
import { documentChecks } from "../review/checks";
import { aliasesFor, termRegex } from "./taxonomy";

/**
 * Explainable, rule-based job-description matching.
 *
 * For each selected requirement the résumé is searched for evidence:
 *   demonstrated — the term (or a known spelling) appears in experience,
 *                  project, certification, or education content;
 *   equivalent   — a closely related tool or skill appears there instead
 *                  (e.g. Splunk for "SIEM", Ubuntu for "Linux");
 *   mentioned    — the term appears only in the skills list or summary;
 *   missing      — not found anywhere;
 *   insufficient — the requirement cannot be judged automatically
 *                  (responsibilities, experience without dates, unclear education).
 *
 * Nothing here infers expertise from an unrelated keyword, and nothing changes
 * the résumé. The score is an internal heuristic, not an employer ATS score.
 */

export type MatchStatus = "demonstrated" | "equivalent" | "mentioned" | "missing" | "insufficient";
export type MatchGroup = "matched" | "strengthen" | "missing" | "review";

export type Evidence = { section: string; label: string; text: string };

export type RequirementMatch = {
  requirement: Requirement;
  status: MatchStatus;
  group: MatchGroup;
  evidence: Evidence[];
  explanation: string;
};

export type MatchResult = {
  matches: RequirementMatch[];
  score: number;
  coverage: number;
  requiredCoverage: { met: number; total: number };
  preferredCoverage: { met: number; total: number };
  evidenceQuality: number;
  documentQuality: { passed: number; total: number; percent: number };
  counts: Record<MatchGroup, number>;
};

/** Related terms that credibly demonstrate a requirement. Kept deliberately small and conservative. */
const EQUIVALENTS: Record<string, string[]> = {
  siem: ["Splunk", "IBM QRadar", "Microsoft Sentinel", "Elastic SIEM", "ArcSight", "LogRhythm"],
  linux: ["Ubuntu", "Red Hat Enterprise Linux", "CentOS", "Debian", "Fedora"],
  "ticketing systems": ["ServiceNow", "Jira", "Zendesk", "Freshservice"],
  "help desk support": ["service desk", "desktop support", "IT support", "technical support"],
  "ci/cd": ["GitHub Actions", "GitLab CI", "Jenkins", "CircleCI", "Azure DevOps"],
  "unit testing": ["Jest", "pytest", "JUnit", "Vitest", "Mocha"],
  "data visualization": ["Tableau", "Power BI", "Looker"],
  virtualization: ["VMware", "Hyper-V", "VirtualBox", "Proxmox VE"],
  sql: ["PostgreSQL", "MySQL", "Microsoft SQL Server", "SQLite", "Oracle Database"],
  "edr": ["CrowdStrike Falcon", "SentinelOne", "Microsoft Defender"],
  "vulnerability management": ["Nessus", "Qualys", "Tenable", "OpenVAS"],
  "infrastructure as code": ["Terraform", "AWS CloudFormation", "Ansible", "Pulumi"],
  "identity & access management": ["Active Directory", "Okta", "Microsoft Entra ID", "AWS IAM"],
  "routing and switching": ["Cisco IOS", "OSPF", "BGP", "VLAN", "OSI model"],
  "data center operations": ["Rack installation", "Structured cabling", "RAID", "Hardware troubleshooting"],
};

type Source = { section: string; label: string; text: string; strong: boolean };

function collectSources(resume: Resume): Source[] {
  const sources: Source[] = [];
  const push = (section: string, label: string, text: string, strong: boolean) => text.trim() && sources.push({ section, label, text, strong });
  for (const entry of resume.experience) {
    const label = [entry.title, entry.employer].filter(Boolean).join(", ") || "Experience entry";
    push("Experience", label, [entry.title, entry.employer].filter(Boolean).join(" — "), true);
    entry.bullets.forEach((bullet) => push("Experience", label, bullet, true));
  }
  for (const project of resume.projects) {
    const label = project.name || "Project";
    push("Projects", label, [project.name, project.role, project.technologies.join(", ")].filter(Boolean).join(" — "), true);
    push("Projects", label, project.description, true);
    project.bullets.forEach((bullet) => push("Projects", label, bullet, true));
  }
  for (const cert of resume.certifications) push("Certifications", cert.name, [cert.name, cert.issuer].filter(Boolean).join(", "), true);
  for (const education of resume.education) {
    const label = education.institution || "Education";
    push("Education", label, [education.degree, education.field, education.institution].filter(Boolean).join(", "), true);
    education.details.forEach((detail) => push("Education", label, detail, true));
  }
  for (const category of resume.skills) push("Skills", category.name || "Skills", `${category.name}: ${category.skills.join(", ")}`, false);
  push("Summary", "Professional summary", resume.summary, false);
  for (const section of resume.custom) section.items.forEach((item) => push(section.title, section.title, item.text, false));
  for (const item of resume.awards) push("Awards", "Awards", item.text, false);
  return sources;
}

const findIn = (sources: Source[], spellings: string[]) =>
  sources.filter((source) => spellings.some((spelling) => termRegex(spelling, "").test(source.text)));

const toEvidence = (sources: Source[]): Evidence[] => {
  const seen = new Set<string>();
  return sources
    .filter((source) => (seen.has(source.text) ? false : (seen.add(source.text), true)))
    .slice(0, 3)
    .map(({ section, label, text }) => ({ section, label, text }));
};

const STOP = new Set(["and", "or", "the", "a", "an", "of", "in", "with", "for", "to", "on", "our", "your", "role", "experience", "years", "year", "using", "as", "at", "by", "from", "including", "related", "similar", "field", "etc", "will", "be", "is", "are", "all", "any", "other", "new", "work", "provide"]);
const contentWords = (text: string) => [...new Set(text.toLowerCase().replace(/[^a-z0-9+#/ ]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word)))];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SEASONS: Record<string, number> = { spring: 3, summer: 6, fall: 9, autumn: 9, winter: 12 };

/** Parse a résumé date into a fractional year; null when it cannot be read. */
export function parseDate(text: string, now = new Date()): number | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/present|current|now|today/.test(value)) return now.getFullYear() + now.getMonth() / 12;
  const year = value.match(/(19|20)\d{2}/);
  const numeric = value.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (numeric) {
    const y = Number(numeric[2].length === 2 ? `20${numeric[2]}` : numeric[2]);
    return y + (Number(numeric[1]) - 1) / 12;
  }
  if (!year) return null;
  const month = MONTHS.findIndex((name) => value.includes(name));
  const season = Object.entries(SEASONS).find(([name]) => value.includes(name));
  return Number(year[0]) + (month >= 0 ? month / 12 : season ? (season[1] - 1) / 12 : 0);
}

const DEGREE_RANK: Array<[RegExp, number]> = [
  [/doctor|ph\.?\s?d/i, 4],
  [/master|\bm\.?s\.?c?\b|\bm\.?a\.?\b|mba|m\.?eng/i, 3],
  [/bachelor|\bb\.?s\.?c?\b|\bb\.?a\.?\b|b\.?eng/i, 2],
  [/associate|\ba\.?a\.?s?\b|\ba\.?s\.?\b/i, 1],
  [/high school|ged|diploma/i, 0],
];
const degreeRank = (text: string) => DEGREE_RANK.find(([pattern]) => pattern.test(text))?.[1] ?? null;

function evaluate(requirement: Requirement, resume: Resume, sources: Source[]): Omit<RequirementMatch, "group" | "requirement"> {
  const strong = sources.filter((source) => source.strong);
  const weak = sources.filter((source) => !source.strong);

  if (requirement.category === "Experience") {
    const years = Number(requirement.term.match(/^(\d+)/)?.[1] ?? NaN);
    const area = requirement.term.split(":")[1] ?? "";
    const words = contentWords(area);
    const roles = resume.experience.filter((entry) => {
      if (!words.length) return true;
      const text = [entry.title, entry.employer, ...entry.bullets].join(" ").toLowerCase();
      return words.filter((word) => text.includes(word)).length >= Math.max(1, Math.ceil(words.length / 2));
    });
    if (!roles.length) return { status: "missing", evidence: [], explanation: words.length ? `No role mentions ${area.trim()}.` : "No experience entries were found." };
    let total = 0;
    let undated = 0;
    for (const role of roles) {
      const start = parseDate(role.startDate);
      const end = role.current ? parseDate("present") : parseDate(role.endDate);
      if (start === null || end === null || end < start) undated++;
      else total += end - start;
    }
    const evidence = roles.slice(0, 3).map((role) => ({ section: "Experience", label: [role.title, role.employer].filter(Boolean).join(", "), text: `${role.startDate || "?"} – ${role.current ? "Present" : role.endDate || "?"}` }));
    const rounded = Math.round(total * 10) / 10;
    if (undated && rounded < years) return { status: "insufficient", evidence, explanation: `${undated} related role${undated === 1 ? " is" : "s are"} missing dates, so years of experience cannot be calculated.` };
    if (Number.isFinite(years) && rounded >= years) return { status: "demonstrated", evidence, explanation: `Related roles add up to about ${rounded} years (needs ${years}).` };
    return { status: "mentioned", evidence, explanation: `Related roles add up to about ${rounded} years; the posting asks for ${years}.` };
  }

  if (requirement.category === "Education") {
    const needed = degreeRank(requirement.term);
    const entries = resume.education.map((entry) => ({ entry, rank: degreeRank(`${entry.degree} ${entry.field}`) }));
    const best = entries.filter((item) => item.rank !== null).sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0];
    if (!entries.length) return { status: "missing", evidence: [], explanation: "No education entries were found." };
    if (!best || needed === null) return { status: "insufficient", evidence: toEvidence(strong.filter((source) => source.section === "Education")), explanation: "The degree level could not be compared automatically." };
    const evidence = [{ section: "Education", label: best.entry.institution, text: [best.entry.degree, best.entry.field].filter(Boolean).join(", ") }];
    if ((best.rank ?? 0) >= needed) {
      const field = requirement.term.split(" in ")[1];
      const fieldOk = !field || contentWords(field).some((word) => `${best.entry.field} ${best.entry.degree}`.toLowerCase().includes(word));
      return fieldOk
        ? { status: "demonstrated", evidence, explanation: "Your degree level meets the stated requirement." }
        : { status: "equivalent", evidence, explanation: `Your degree level meets the requirement, in a different field than ${field}. Many postings accept related fields; check the wording.` };
    }
    return { status: "insufficient", evidence, explanation: "Your highest listed degree is below the stated level. Check whether the posting accepts equivalent experience." };
  }

  if (requirement.kind === "responsibility" && requirement.category === "Responsibilities") {
    const words = contentWords(requirement.term);
    const scored = strong.map((source) => ({ source, hits: words.filter((word) => source.text.toLowerCase().includes(word)).length })).sort((a, b) => b.hits - a.hits);
    const top = scored[0];
    if (top && words.length && top.hits >= Math.max(2, Math.ceil(words.length * 0.5))) return { status: "equivalent", evidence: toEvidence(scored.filter((item) => item.hits === top.hits).map((item) => item.source)), explanation: `A bullet shares ${top.hits} of ${words.length} key words with this responsibility. Confirm it describes similar work.` };
    return { status: "insufficient", evidence: top && top.hits ? toEvidence([top.source]) : [], explanation: "Responsibilities are compared by wording only; review whether your experience covers this." };
  }

  const spellings = [...new Set([requirement.term, ...aliasesFor(requirement.term), ...requirement.phrases])];
  const direct = findIn(strong, spellings);
  if (direct.length) return { status: "demonstrated", evidence: toEvidence(direct), explanation: `Found in ${[...new Set(direct.map((source) => source.section))].join(" and ")}.` };
  const related = (EQUIVALENTS[requirement.term.toLowerCase()] ?? []).flatMap((term) => aliasesFor(term));
  const equivalent = related.length ? findIn(strong, related) : [];
  if (equivalent.length) return { status: "equivalent", evidence: toEvidence(equivalent), explanation: "A closely related tool or skill appears in your experience. Name the requirement directly if it is accurate." };
  const mentioned = findIn(weak, spellings);
  if (mentioned.length) return { status: "mentioned", evidence: toEvidence(mentioned), explanation: `Listed in ${[...new Set(mentioned.map((source) => source.section))].join(" and ")} without an example of use.` };
  return { status: "missing", evidence: [], explanation: "Not found in the résumé." };
}

function groupFor(status: MatchStatus, requirement: Requirement): MatchGroup {
  if (status === "demonstrated" || status === "equivalent") return requirement.uncertain ? "review" : "matched";
  if (status === "insufficient") return "review";
  if (status === "mentioned") return "strengthen";
  // Missing:
  if (requirement.possession === "has") return "strengthen";
  if (requirement.possession === "uncertain" || requirement.uncertain) return "review";
  return "missing";
}

const WEIGHTS = { required: 3, preferred: 1.5, responsibility: 1, context: 0 } as const;
const CREDIT: Record<MatchStatus, number> = { demonstrated: 1, equivalent: 0.8, mentioned: 0.4, insufficient: 0.25, missing: 0 };

export const SCORE_METHOD = [
  "Each selected confirmed requirement gets credit for the evidence found: demonstrated 100%, credible equivalent 80%, mentioned only in skills or summary 40%, cannot be judged automatically 25%, not found 0%.",
  "Credit is weighted by type: required ×3, preferred ×1.5, responsibility ×1. General-context terms and unconfirmed ambiguous acronyms are not scored automatically.",
  "Requirement coverage is the weighted share of credit earned.",
  "Evidence quality is the share of matched requirements backed by experience, projects, certifications, or education rather than only a skills list.",
  "Job Description Match Score = 80% requirement coverage + 20% evidence quality.",
  "Document quality (structure and readability checks) is reported separately and does not change the match score.",
];

const isConfirmedForScore = (requirement: Requirement) => !requirement.uncertain || requirement.possession === "has";

export function matchResume(resume: Resume, requirements: Requirement[], settings: DocumentSettings, pageCount = 1): MatchResult {
  const sources = collectSources(resume);
  const matches = requirements
    .filter((requirement) => requirement.selected)
    .map((requirement) => {
      const result = evaluate(requirement, resume, sources);
      return { requirement, ...result, group: groupFor(result.status, requirement) };
    });

  const scoredMatches = matches.filter((match) => isConfirmedForScore(match.requirement));

  let earned = 0;
  let possible = 0;
  for (const match of scoredMatches) {
    const weight = WEIGHTS[match.requirement.kind];
    possible += weight;
    earned += weight * CREDIT[match.status];
  }
  const coverage = possible ? Math.round((earned / possible) * 100) : 0;
  const matched = scoredMatches.filter((match) => match.status === "demonstrated" || match.status === "equivalent" || match.status === "mentioned");
  const backed = matched.filter((match) => match.evidence.some((item) => !["Skills", "Summary"].includes(item.section)));
  const evidenceQuality = matched.length ? Math.round((backed.length / matched.length) * 100) : 0;
  const met = (kind: Requirement["kind"]) => {
    const items = scoredMatches.filter((match) => match.requirement.kind === kind);
    return { met: items.filter((match) => match.status === "demonstrated" || match.status === "equivalent").length, total: items.length };
  };
  const checks = documentChecks(resume, settings, pageCount);
  const passed = checks.filter((check) => check.ok).length;
  const counts: Record<MatchGroup, number> = { matched: 0, strengthen: 0, missing: 0, review: 0 };
  for (const match of matches) counts[match.group]++;
  return {
    matches,
    score: scoredMatches.length ? Math.round(coverage * 0.8 + evidenceQuality * 0.2) : 0,
    coverage,
    requiredCoverage: met("required"),
    preferredCoverage: met("preferred"),
    evidenceQuality,
    documentQuality: { passed, total: checks.length, percent: Math.round((passed / checks.length) * 100) },
    counts,
  };
}

/** Explain what changed between two results, requirement by requirement. */
export function diffMatches(previous: MatchResult | null, next: MatchResult): string[] {
  if (!previous) return [];
  const before = new Map(previous.matches.map((match) => [match.requirement.id, match]));
  const lines: string[] = [];
  for (const match of next.matches) {
    const old = before.get(match.requirement.id);
    if (!old) lines.push(`“${match.requirement.term}” is now included.`);
    else if (old.status !== match.status) lines.push(`“${match.requirement.term}”: ${old.status} → ${match.status}.`);
    before.delete(match.requirement.id);
  }
  for (const old of before.values()) lines.push(`“${old.requirement.term}” is no longer included.`);
  return lines;
}
