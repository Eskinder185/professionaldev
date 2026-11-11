import type { DocumentSettings, JobTarget, Resume, SectionKey } from "../model/types";
import { layoutResume } from "./engine";
import { defaultMeasurer, type Measurer } from "./measurer";
import { effectiveSettings, LIMITS } from "./templates";
import type { FitReport } from "./types";

/**
 * One-page fitting. Order of preference, per the product rules:
 *   1. layout-only changes inside readable limits (spacing, margins, type)
 *   2. user-approved content changes (wording, then least relevant bullets, then optional sections)
 * Nothing is removed silently, and the master résumé is never edited here:
 * content changes are meant to be applied to a separate tailored version.
 */

export type LayoutAdjustment = { id: string; label: string };

export type LayoutOptimization = {
  settings: DocumentSettings;
  adjustments: LayoutAdjustment[];
  fit: FitReport;
  /** True when settings changed. */
  changed: boolean;
};

type Step = { id: string; label: string; apply: (s: ReturnType<typeof effectiveSettings>) => Partial<DocumentSettings> | null };

const round = (n: number) => Math.round(n * 100) / 100;

const STEPS: Step[] = [
  { id: "section-spacing-6", label: "Section spacing 8 → 6 pt", apply: (s) => (s.sectionSpacing > 6 ? { sectionSpacing: 6 } : null) },
  { id: "line-1.18", label: "Line spacing → 1.18", apply: (s) => (s.lineSpacing > 1.18 ? { lineSpacing: 1.18 } : null) },
  { id: "section-spacing-min", label: `Section spacing → ${LIMITS.sectionSpacingMin + 1} pt`, apply: (s) => (s.sectionSpacing > LIMITS.sectionSpacingMin + 1 ? { sectionSpacing: LIMITS.sectionSpacingMin + 1 } : null) },
  { id: "bullet-indent", label: "Bullet indent → 14 pt", apply: (s) => (s.bulletIndent > 14 ? { bulletIndent: 14 } : null) },
  { id: "line-min", label: `Line spacing → ${LIMITS.lineMin}`, apply: (s) => (s.lineSpacing > LIMITS.lineMin ? { lineSpacing: LIMITS.lineMin } : null) },
  { id: "margin-pref", label: `Margins → ${LIMITS.marginPreferredMin} in`, apply: (s) => (s.margin > LIMITS.marginPreferredMin ? { margin: LIMITS.marginPreferredMin } : null) },
  { id: "font-10.25", label: "Body text → 10.25 pt", apply: (s) => (s.fontSize > 10.25 ? { fontSize: 10.25 } : null) },
  { id: "font-min", label: `Body text → ${LIMITS.fontMin} pt (readable minimum)`, apply: (s) => (s.fontSize > LIMITS.fontMin ? { fontSize: LIMITS.fontMin } : null) },
];

/** Try layout-only adjustments, least visible first, stopping as soon as the page fits. */
export function optimizeLayout(resume: Resume, settings: DocumentSettings, measure: Measurer = defaultMeasurer): LayoutOptimization {
  let current = effectiveSettings(settings) as DocumentSettings;
  let fit = layoutResume(resume, current, measure).fit;
  const adjustments: LayoutAdjustment[] = [];
  for (const step of STEPS) {
    if (fit.fitsOnePage) break;
    const change = step.apply(effectiveSettings(current));
    if (!change) continue;
    current = { ...current, ...change };
    adjustments.push({ id: step.id, label: step.label });
    fit = layoutResume(resume, current, measure).fit;
  }
  return { settings: { ...current, margin: round(current.margin), fontSize: round(current.fontSize) }, adjustments, fit, changed: adjustments.length > 0 };
}

/** Truthful, deterministic wording tightening. Meaning is unchanged; each edit is shown before/after. */
const TIGHTEN: Array<[RegExp, string]> = [
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\ba (?:large )?number of\b/gi, "several"],
  [/\bon a (daily|weekly|monthly) basis\b/gi, "$1"],
  [/\bat this point in time\b/gi, "now"],
  [/\butilized\b/gi, "used"],
  [/\butilizing\b/gi, "using"],
  [/\butilize\b/gi, "use"],
  [/\bhelped to\b/gi, "helped"],
  [/\s{2,}/g, " "],
];

export function tightenWording(text: string): string {
  let out = text;
  for (const [pattern, replacement] of TIGHTEN) out = out.replace(pattern, replacement as string);
  return out.trim();
}

export type FitProposal = {
  id: string;
  kind: "tighten-wording" | "remove-bullet" | "hide-section";
  /** Where in the résumé, e.g. "Experience · Lone Star Health Services". */
  location: string;
  before: string;
  after: string;
  reason: string;
  /** Lines the résumé shrinks by when only this change is applied. */
  linesSaved: number;
  /** Relevance to the target job, 0–1 (0.5 when no job is set). */
  relevance: number;
  apply: (resume: Resume, settings: DocumentSettings) => { resume: Resume; settings: DocumentSettings };
};

export type Relevance = (text: string) => number;

/** Fraction of weighted, confirmed job requirements a text mentions. No job → neutral. */
export function relevanceFromJob(job?: JobTarget): Relevance {
  const terms = (job?.requirements ?? []).filter((requirement) => requirement.selected && requirement.kind !== "context" && !requirement.uncertain);
  if (!terms.length) return () => 0.5;
  const matchers = terms.map((requirement) => ({
    weight: requirement.kind === "required" ? 2 : 1,
    patterns: [requirement.term, ...requirement.phrases].filter(Boolean).map((phrase) => new RegExp(`(^|[^A-Za-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Za-z0-9])`, "i")),
  }));
  const total = matchers.reduce((sum, matcher) => sum + matcher.weight, 0);
  return (text) => Math.min(1, matchers.reduce((sum, matcher) => sum + (matcher.patterns.some((pattern) => pattern.test(text)) ? matcher.weight : 0), 0) / Math.max(1, total / 3));
}

const OPTIONAL_SECTIONS: SectionKey[] = ["summary", "awards", "publications"];

const linesOf = (resume: Resume, settings: DocumentSettings, measure: Measurer) => {
  const layout = layoutResume(resume, settings, measure);
  return layout.pages.reduce((sum, page) => sum + page.lines.length, 0) + layout.fit.usedPt / 1000;
};

/** Candidate content changes with their measured effect on length. Nothing is applied. */
export function proposeFitChanges(resume: Resume, settings: DocumentSettings, measure: Measurer = defaultMeasurer, relevance: Relevance = () => 0.5): FitProposal[] {
  const baseline = linesOf(resume, settings, measure);
  const proposals: FitProposal[] = [];
  const saved = (nextResume: Resume, nextSettings: DocumentSettings) => Math.round(baseline - linesOf(nextResume, nextSettings, measure));

  // 1. Wording tightening (no information removed).
  type Holder = { label: string; get: () => string[]; set: (r: Resume, next: string[]) => void };
  const holders: Holder[] = [];
  resume.experience.forEach((entry, i) => holders.push({ label: `Experience · ${entry.employer || entry.title}`, get: () => entry.bullets, set: (r, next) => (r.experience[i].bullets = next) }));
  resume.projects.forEach((entry, i) => holders.push({ label: `Projects · ${entry.name}`, get: () => entry.bullets, set: (r, next) => (r.projects[i].bullets = next) }));
  holders.forEach((holder) =>
    holder.get().forEach((bullet, index) => {
      const after = tightenWording(bullet);
      if (after === bullet.trim() || !after) return;
      const next = structuredClone(resume);
      const list = [...holder.get()];
      list[index] = after;
      holder.set(next, list);
      proposals.push({
        id: `tighten:${holder.label}:${index}`,
        kind: "tighten-wording",
        location: holder.label,
        before: bullet,
        after,
        reason: "Shorter wording with the same meaning; no facts changed.",
        linesSaved: saved(next, settings),
        relevance: relevance(bullet),
        apply: (r, s) => {
          const clone = structuredClone(r);
          const items = [...holder.get()];
          const at = items.indexOf(bullet);
          if (at < 0) return { resume: r, settings: s };
          items[at] = after;
          holder.set(clone, items);
          return { resume: clone, settings: s };
        },
      });
    }),
  );

  // 2. Least relevant bullets. Each entry keeps its first bullet; the most recent job keeps two.
  resume.experience.forEach((entry, entryIndex) => {
    const keep = entryIndex === 0 ? 2 : 1;
    entry.bullets.forEach((bullet, index) => {
      if (index < keep || !bullet.trim()) return;
      const next = structuredClone(resume);
      next.experience[entryIndex].bullets = entry.bullets.filter((_, i) => i !== index);
      const linesSaved = saved(next, settings);
      if (linesSaved <= 0) return;
      proposals.push({
        id: `remove:exp:${entry.id}:${index}`,
        kind: "remove-bullet",
        location: `Experience · ${entry.employer || entry.title}`,
        before: bullet,
        after: "",
        reason: relevance(bullet) < 0.34 ? "Few confirmed job requirements are evidenced here." : "Lower priority than the other bullets for this entry.",
        linesSaved,
        relevance: relevance(bullet),
        apply: (r, s) => {
          const clone = structuredClone(r);
          const target = clone.experience.find((item) => item.id === entry.id);
          if (target) target.bullets = target.bullets.filter((text) => text !== bullet);
          return { resume: clone, settings: s };
        },
      });
    });
  });
  resume.projects.forEach((entry, entryIndex) => {
    entry.bullets.forEach((bullet, index) => {
      if (index < 1 || !bullet.trim()) return;
      const next = structuredClone(resume);
      next.projects[entryIndex].bullets = entry.bullets.filter((_, i) => i !== index);
      const linesSaved = saved(next, settings);
      if (linesSaved <= 0) return;
      proposals.push({
        id: `remove:proj:${entry.id}:${index}`,
        kind: "remove-bullet",
        location: `Projects · ${entry.name}`,
        before: bullet,
        after: "",
        reason: "Lower priority than the project's first bullet.",
        linesSaved,
        relevance: relevance(bullet),
        apply: (r, s) => {
          const clone = structuredClone(r);
          const target = clone.projects.find((item) => item.id === entry.id);
          if (target) target.bullets = target.bullets.filter((text) => text !== bullet);
          return { resume: clone, settings: s };
        },
      });
    });
  });

  // 3. Optional sections can be left off this version (content stays in the master).
  for (const key of OPTIONAL_SECTIONS) {
    if ((settings.hiddenSections ?? []).includes(key)) continue;
    const nextSettings = { ...settings, hiddenSections: [...(settings.hiddenSections ?? []), key] };
    const linesSaved = saved(resume, nextSettings);
    if (linesSaved <= 0) continue;
    proposals.push({
      id: `hide:${key}`,
      kind: "hide-section",
      location: key[0].toUpperCase() + key.slice(1),
      before: `${key[0].toUpperCase() + key.slice(1)} section`,
      after: "",
      reason: "Optional section. It stays in your master résumé and can be shown again.",
      linesSaved,
      relevance: 0.3,
      apply: (r, s) => ({ resume: r, settings: { ...s, hiddenSections: [...(s.hiddenSections ?? []), key] } }),
    });
  }
  return proposals;
}

export type FitPlan = {
  /** Proposal ids suggested, in the order they would be applied. Suggestions only. */
  suggested: string[];
  fitsAfter: boolean;
  remainingOverflowLines: number;
};

/**
 * Suggest the smallest set of proposals that reaches one page: wording first (loses nothing),
 * then the least relevant bullets, then optional sections. Re-measures after every pick.
 */
export function planFit(resume: Resume, settings: DocumentSettings, measure: Measurer = defaultMeasurer, proposals: FitProposal[]): FitPlan {
  const order = [...proposals].sort((a, b) => {
    const rank = (p: FitProposal) => (p.kind === "tighten-wording" ? 0 : p.kind === "remove-bullet" ? 1 : 2);
    return rank(a) - rank(b) || a.relevance - b.relevance || b.linesSaved - a.linesSaved;
  });
  let current = { resume, settings };
  const suggested: string[] = [];
  let fit = layoutResume(current.resume, current.settings, measure).fit;
  for (const proposal of order) {
    if (fit.fitsOnePage) break;
    const next = proposal.apply(current.resume, current.settings);
    const nextFit = layoutResume(next.resume, next.settings, measure).fit;
    if (nextFit.usedPt >= fit.usedPt - 0.5) continue;
    current = next;
    fit = nextFit;
    suggested.push(proposal.id);
  }
  return { suggested, fitsAfter: fit.fitsOnePage, remainingOverflowLines: fit.overflowLines };
}

/** Options to offer when content cannot reach one page within readable limits. */
export const BLOCKED_CHOICES = [
  { id: "review-removals", label: "Review and approve removals", detail: "Choose which lower-priority bullets or sections to leave off this tailored version." },
  { id: "allow-two-pages", label: "Allow a two-page document", detail: "Switch this version to multi-page. Text stays at a readable size." },
  { id: "edit-manually", label: "Edit content manually", detail: "Shorten or merge entries yourself, then re-check the fit." },
] as const;
