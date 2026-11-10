import { uid } from "../model/defaults";
import type { JobTarget, Possession, Requirement, RequirementKind } from "../model/types";
import { extractRequirements } from "./extractRequirements";

export const KIND_LABELS: Record<RequirementKind, string> = {
  required: "Required",
  preferred: "Preferred",
  responsibility: "Responsibility",
  context: "General context",
};

export const POSSESSION_LABELS: Record<Possession, string> = {
  unanswered: "Not answered",
  has: "I have this",
  not: "I don't have this",
  uncertain: "Not sure",
};

export const emptyJob = (): JobTarget => ({ title: "", description: "", requirements: [] });

const KINDS: RequirementKind[] = ["required", "preferred", "responsibility", "context"];
const POSSESSIONS: Possession[] = ["unanswered", "has", "not", "uncertain"];

/** Repair a stored job target so older or hand-edited data cannot break the panel. */
export function normalizeJob(value: unknown): JobTarget | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const job = value as Partial<JobTarget>;
  const requirements = Array.isArray(job.requirements) ? job.requirements : [];
  return {
    title: String(job.title ?? ""),
    description: String(job.description ?? ""),
    analyzedAt: job.analyzedAt,
    analyzedDescription: job.analyzedDescription,
    removedTerms: Array.isArray(job.removedTerms) ? job.removedTerms.map(String) : [],
    rejectedSuggestions: Array.isArray(job.rejectedSuggestions) ? job.rejectedSuggestions.map(String) : [],
    requirements: requirements
      .filter((item): item is Requirement => typeof item === "object" && item !== null && typeof item.term === "string" && item.term.trim() !== "")
      .map((item) => ({
        id: item.id || uid(),
        term: item.term,
        phrases: Array.isArray(item.phrases) ? item.phrases.map(String) : [],
        snippets: Array.isArray(item.snippets) ? item.snippets.map(String) : [],
        category: item.category || "Other",
        kind: KINDS.includes(item.kind) ? item.kind : "required",
        selected: item.selected !== false,
        possession: POSSESSIONS.includes(item.possession) ? item.possession : "unanswered",
        origin: item.origin === "user" ? "user" : "detected",
        uncertain: item.uncertain || undefined,
      })),
  };
}

/**
 * Analyze a description and merge with previous work: the user's selections,
 * category and kind changes, possession answers and added requirements are kept;
 * detected requirements the user removed stay removed.
 */
export function analyzeJob(job: JobTarget): JobTarget {
  const { requirements: detected } = extractRequirements(job.description);
  const previous = new Map(job.requirements.map((item) => [item.term.toLowerCase(), item]));
  const removed = new Set((job.removedTerms ?? []).map((term) => term.toLowerCase()));
  const merged: Requirement[] = [];
  for (const item of detected) {
    const key = item.term.toLowerCase();
    if (removed.has(key)) continue;
    const prior = previous.get(key);
    merged.push(prior ? { ...item, id: prior.id, category: prior.category, kind: prior.kind, selected: prior.selected, possession: prior.possession, uncertain: prior.uncertain && item.uncertain } : item);
    previous.delete(key);
  }
  for (const prior of previous.values()) if (prior.origin === "user") merged.push(prior);
  return { ...job, requirements: merged, analyzedAt: new Date().toISOString(), analyzedDescription: job.description };
}

export function addRequirement(job: JobTarget, term: string, category: string, kind: RequirementKind): JobTarget {
  const clean = term.trim();
  if (!clean) return job;
  const existing = job.requirements.find((item) => item.term.toLowerCase() === clean.toLowerCase());
  if (existing) return updateRequirement(job, existing.id, { selected: true });
  const requirement: Requirement = { id: uid(), term: clean, phrases: [], snippets: [], category: category.trim() || "Added by me", kind, selected: true, possession: "unanswered", origin: "user" };
  return { ...job, requirements: [...job.requirements, requirement], removedTerms: (job.removedTerms ?? []).filter((removed) => removed.toLowerCase() !== clean.toLowerCase()) };
}

export function updateRequirement(job: JobTarget, id: string, change: Partial<Requirement>): JobTarget {
  return { ...job, requirements: job.requirements.map((item) => (item.id === id ? { ...item, ...change, uncertain: change.category || change.kind ? undefined : item.uncertain } : item)) };
}

export function removeRequirement(job: JobTarget, id: string): JobTarget {
  const target = job.requirements.find((item) => item.id === id);
  const removedTerms = target?.origin === "detected" ? [...(job.removedTerms ?? []), target.term] : job.removedTerms;
  return { ...job, requirements: job.requirements.filter((item) => item.id !== id), removedTerms };
}

export function renameCategory(job: JobTarget, from: string, to: string): JobTarget {
  const name = to.trim();
  if (!name || name === from) return job;
  return { ...job, requirements: job.requirements.map((item) => (item.category === from ? { ...item, category: name } : item)) };
}

export function requirementSummary(requirements: Requirement[]) {
  const selected = requirements.filter((item) => item.selected);
  const count = (predicate: (item: Requirement) => boolean) => selected.filter(predicate).length;
  return {
    total: requirements.length,
    selected: selected.length,
    required: count((item) => item.kind === "required"),
    preferred: count((item) => item.kind === "preferred"),
    responsibilities: count((item) => item.kind === "responsibility"),
    has: count((item) => item.possession === "has"),
    not: count((item) => item.possession === "not"),
    uncertain: count((item) => item.possession === "uncertain"),
    unanswered: count((item) => item.possession === "unanswered"),
  };
}
