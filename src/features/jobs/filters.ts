import type { JobFilters, JobPosting, JobStoreState } from "./schema";
import { extractGlance } from "./text";

const HOURS_PER_YEAR = 2080;

/** Annualised top of the posted range, or null when the posting states no salary. */
export function annualSalary(p: JobPosting): number | null {
  const s = p.salary;
  const top = s?.max ?? s?.min ?? null;
  if (!s || top == null) return null;
  const mult = s.period === "hour" ? HOURS_PER_YEAR : s.period === "month" ? 12 : s.period === "week" ? 52 : s.period === "day" ? 260 : 1;
  return top * mult;
}

export function levelOf(p: JobPosting): "entry" | "mid" | "senior" | null {
  return extractGlance(p).experienceLevel;
}

export function matchesFilters(p: JobPosting, f: JobFilters, saved: ReadonlySet<string>, now = Date.now()): boolean {
  if (f.savedOnly && !saved.has(p.id)) return false;
  const q = f.query.trim().toLowerCase();
  if (q) {
    const hay = `${p.title} ${p.company} ${p.location} ${p.category} ${p.description} ${p.skills.join(" ")}`.toLowerCase();
    // Every word must appear, so adding words narrows results.
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  const loc = f.location.trim().toLowerCase();
  if (loc && !`${p.location} ${p.workArrangement === "remote" ? "remote" : ""}`.toLowerCase().includes(loc)) return false;
  if (f.employmentType !== "any" && p.employmentType !== f.employmentType) return false;
  if (f.arrangement !== "any" && p.workArrangement !== f.arrangement) return false;
  if (f.category && !p.category.toLowerCase().includes(f.category.toLowerCase())) return false;
  if (f.salaryMin != null) {
    const a = annualSalary(p);
    if (a == null || a < f.salaryMin) return false;
  }
  if (f.postedWithinDays != null) {
    const t = p.postedAt ? Date.parse(p.postedAt) : NaN;
    if (!Number.isFinite(t) || now - t > f.postedWithinDays * 86_400_000) return false;
  }
  if (f.experience !== "any" && levelOf(p) !== f.experience) return false;
  return true;
}

export function filterAndSort(
  state: JobStoreState,
  f: JobFilters,
  relevance: ReadonlyMap<string, number> = new Map(),
  now = Date.now(),
): JobPosting[] {
  const saved = new Set(state.saved);
  const dismissed = new Set(state.dismissed);
  const list = Object.values(state.postings).filter((p) => !dismissed.has(p.id) && matchesFilters(p, f, saved, now));
  const newest = (a: JobPosting, b: JobPosting) => Date.parse(b.postedAt ?? b.addedAt) - Date.parse(a.postedAt ?? a.addedAt);
  if (f.sort === "newest") return list.sort(newest);
  return list.sort((a, b) => (relevance.get(b.id) ?? -1) - (relevance.get(a.id) ?? -1) || newest(a, b));
}

export function categoriesOf(state: JobStoreState): string[] {
  return Array.from(new Set(Object.values(state.postings).map((p) => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function activeFilterCount(f: JobFilters): number {
  return [f.query, f.location, f.category].filter((v) => v.trim()).length +
    (f.employmentType !== "any" ? 1 : 0) + (f.experience !== "any" ? 1 : 0) + (f.arrangement !== "any" ? 1 : 0) +
    (f.salaryMin != null ? 1 : 0) + (f.postedWithinDays != null ? 1 : 0) + (f.savedOnly ? 1 : 0);
}

/** Applies the user's saved match preferences. Returns what to show and how many were hidden. */
export function applyPrefs(list: JobPosting[], prefs: import("./schema").MatchPrefs): { shown: JobPosting[]; hidden: number } {
  const words = (v: string) => v.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  const exclude = words(prefs.exclude);
  const locations = words(prefs.locations);
  const shown = list.filter((p) => {
    const hay = `${p.title} ${p.description}`.toLowerCase();
    if (exclude.some((w) => hay.includes(w))) return false;
    if (prefs.minSalary != null) {
      const a = annualSalary(p);
      if (a != null && a < prefs.minSalary) return false;
    }
    if (locations.length) {
      const loc = p.location.toLowerCase();
      const remoteOk = prefs.arrangements.includes("remote") && p.workArrangement === "remote";
      if (!remoteOk && !locations.some((l) => loc.includes(l))) return false;
    }
    if (prefs.experience !== "any") {
      const lvl = levelOf(p);
      if (lvl && lvl !== prefs.experience) return false;
    }
    return true;
  });
  return { shown, hidden: list.length - shown.length };
}
