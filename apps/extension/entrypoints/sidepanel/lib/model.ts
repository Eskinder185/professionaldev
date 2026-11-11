import type { ExtensionPersistentState } from "../../../src/storage/stateStore";
import type {
  AutofillRunState,
  AutoApplyQueueItem,
  RequirementAnalysis,
  ResumeAnalysisSnapshot,
} from "../../../../../packages/careeros-shared/types";

export const PRODUCTION_ORIGIN = "https://eskinder185.github.io";

export function siteBase(state: ExtensionPersistentState | null): string {
  return `${state?.connectedOrigin ?? PRODUCTION_ORIGIN}/professionaldev`;
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * Finds the CareerOS queue item for the current page: explicit `appId` parameter first
 * (CareerOS sandbox links), then the same URL. Never falls back to "whatever is active",
 * so one job's analysis is never shown for another job.
 */
export function matchApplication(state: ExtensionPersistentState | null, url: string | undefined): AutoApplyQueueItem | null {
  if (!state || !url) return null;
  try {
    const appId = new URL(url).searchParams.get("appId");
    if (appId) {
      const byId = state.queue.find((q) => q.id === appId);
      if (byId) return byId;
    }
  } catch {
    /* fall through */
  }
  const target = normalizeUrl(url);
  return state.queue.find((q) => normalizeUrl(q.url) === target || normalizeUrl(q.normalizedUrl) === target) ?? null;
}

export function analysisFor(
  state: ExtensionPersistentState | null,
  app: AutoApplyQueueItem | null,
  versionId: string | undefined,
): ResumeAnalysisSnapshot | null {
  if (!state || !app || !versionId) return null;
  return state.analyses[app.id]?.[versionId] ?? null;
}

export type Override = "na" | "confirmed" | "reviewed";

export interface EffectiveCounts {
  matched: number;
  strengthen: number;
  missing: number;
  review: number;
  notApplicable: number;
  userConfirmed: number;
}

/** Counts shown in the panel. User marks change what is displayed, never the CareerOS score. */
export function effectiveCounts(
  requirements: RequirementAnalysis[],
  overrides: Record<string, Override> | undefined,
): EffectiveCounts {
  const out: EffectiveCounts = { matched: 0, strengthen: 0, missing: 0, review: 0, notApplicable: 0, userConfirmed: 0 };
  for (const r of requirements) {
    const o = overrides?.[r.id];
    if (o === "na") {
      out.notApplicable += 1;
      continue;
    }
    if (o === "confirmed" && (r.group === "missing" || r.group === "review")) {
      out.userConfirmed += 1;
      continue;
    }
    out[r.group] += 1;
  }
  return out;
}

export const GROUP_LABEL: Record<RequirementAnalysis["group"], string> = {
  matched: "Verified match",
  strengthen: "Weak evidence",
  missing: "Missing",
  review: "Uncertain",
};

export function activeRun(state: ExtensionPersistentState | null, localRun: AutofillRunState | null, pageUrl: string | undefined, runnerActive: boolean): AutofillRunState | null {
  const run = localRun ?? state?.autofillRun ?? null;
  if (!run) return null;
  if (pageUrl && normalizeUrl(run.url) !== normalizeUrl(pageUrl)) return null;
  const inFlight = run.phase === "inspecting" || run.phase === "filling" || run.phase === "verifying";
  if (inFlight && !runnerActive && Date.now() - Date.parse(run.updatedAt) > 20_000) {
    return {
      ...run,
      phase: "failed",
      step: "Autofill was interrupted",
      error: "The side panel closed or reloaded during autofill. Review the form before continuing.",
    };
  }
  return run;
}

export function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}

export function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return new Date(t).toLocaleDateString();
}
