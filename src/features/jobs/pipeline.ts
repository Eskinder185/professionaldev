import { getLocal, setLocal } from "../../hooks/useLocal";
import { validateAndAnalyzeJobUrl } from "../../../packages/careeros-shared/schemas";
import type { AutoApplyQueueItem } from "../../../packages/careeros-shared/types";
import type { Application } from "../applications/ApplicationsPage";
import { analyzeAndPrepareQueueItem, ensureResumeVersions, loadAutoApplyQueue, saveAutoApplyQueue, syncQueueItemToApplicationTracker } from "../autoapply/storage";
import { uid } from "../resume/model/defaults";
import { analysisText } from "./analysis";
import type { JobPosting, JobStoreState } from "./schema";
import { formatSalary } from "./text";

export const TRACKER_KEY = "appTracker:items";

/**
 * Adds a posting to the existing application tracker (the same `appTracker:items` store the
 * Applications page and AutoApply use). Idempotent: a posting is only tracked once.
 */
export function trackPosting(state: JobStoreState, posting: JobPosting, resumeVersionId?: string): { state: JobStoreState; applicationId: string; created: boolean } {
  const items = getLocal<Application[]>(TRACKER_KEY, []);
  const existing = items.find((a) => a.id === state.tracked[posting.id] || a.jobId === posting.id || (posting.url && a.url === posting.url));
  if (existing) {
    return { state: { ...state, tracked: { ...state.tracked, [posting.id]: existing.id } }, applicationId: existing.id, created: false };
  }
  const app: Application = {
    id: uid(),
    company: posting.company,
    role: posting.title,
    status: "Saved",
    date: new Date().toISOString().slice(0, 10),
    url: posting.url || undefined,
    notes: `Job reference: ${posting.id}`,
    jobId: posting.id,
    location: posting.location || undefined,
    resumeVersionId,
    source: posting.source,
  };
  setLocal(TRACKER_KEY, [app, ...items]);
  return { state: { ...state, tracked: { ...state.tracked, [posting.id]: app.id } }, applicationId: app.id, created: true };
}

/**
 * Creates (or finds) the AutoApply queue item for a posting, using the posting's real text.
 * Unsupported platforms are queued as "Unsupported" with a manual checklist; nothing is submitted.
 */
export function queuePostingForAutoApply(posting: JobPosting): { item: AutoApplyQueueItem; created: boolean; error?: string } {
  const queue = loadAutoApplyQueue();
  const target = posting.applyUrl || posting.url;
  const parsed = validateAndAnalyzeJobUrl(target);
  if (!parsed.ok) return { item: undefined as never, created: false, error: parsed.error ?? "This posting has no valid application link." };
  const dupe = queue.find((q) => q.normalizedUrl === (parsed.normalizedUrl ?? target) || q.url === target);
  if (dupe) return { item: dupe, created: false };

  const versions = ensureResumeVersions();
  const master = versions.find((v) => v.kind === "master") ?? versions[0];
  const now = new Date().toISOString();
  const base: AutoApplyQueueItem = {
    id: uid(),
    url: target,
    normalizedUrl: parsed.normalizedUrl ?? target,
    company: posting.company,
    title: posting.title,
    location: posting.location,
    source: parsed.sourceHost ?? posting.source,
    platform: parsed.platform ?? "generic",
    supportLevel: parsed.supportLevel ?? "supported",
    status: parsed.platform === "unsupported" ? "Unsupported" : "Ready to prepare",
    pageStage: "page_detected",
    matchScore: null,
    matchedSkills: [],
    missingSkills: [],
    missingInfo: [],
    selectedResumeId: master?.id ?? "",
    selectedResumeName: master?.name ?? "",
    resumeFitsOnePage: true,
    jobDescription: analysisText(posting),
    preparedQuestions: [],
    detectedFields: [],
    nextAction: "",
    notes: posting.salary ? `Posted salary: ${formatSalary(posting.salary)}` : "",
    followUpDate: "",
    createdAt: now,
    updatedAt: now,
  };
  const prepared = analyzeAndPrepareQueueItem(base, versions);
  prepared.trackerApplicationId = syncQueueItemToApplicationTracker(prepared);
  saveAutoApplyQueue([prepared, ...queue]);
  return { item: prepared, created: true };
}
