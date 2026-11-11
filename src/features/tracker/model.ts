import { getLocal, setLocal } from "../../hooks/useLocal";

/**
 * The one application record used by the tracker, Jobs, AutoApply and Documents.
 * It extends the original shape additively, so records saved by older versions load unchanged.
 */
export type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  /** Date added, or the application date once applied (YYYY-MM-DD). */
  date: string;
  notes?: string;
  url?: string;
  followUp?: string;
  jobId?: string;
  location?: string;
  resumeVersionId?: string;
  coverLetterId?: string;
  favorite?: boolean;
  archived?: boolean;
  source?: string;
  history?: HistoryEvent[];
  interviews?: Interview[];
  reminders?: Reminder[];
};

export type HistoryEvent = { at: string; event: string };
export type Interview = { id: string; date: string; kind: string; notes: string };
export type Reminder = { id: string; date: string; text: string; done: boolean };

export const TRACKER_KEY = "appTracker:items";
export const REVIEW_KEY = "pd:careeros:tracker-review";

export const STAGES = ["Saved", "Preparing", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"] as const;
export const normalizeStatus = (status: string) => (status === "Phone Screen" ? "Screening" : (STAGES as readonly string[]).includes(status) ? status : "Applied");

/** Board columns. "Interviewing" holds both Screening and Interview; the card keeps its precise status. */
export const COLUMNS: Array<{ id: string; label: string; statuses: string[]; dropStatus: string }> = [
  { id: "saved", label: "Saved", statuses: ["Saved"], dropStatus: "Saved" },
  { id: "preparing", label: "Preparing", statuses: ["Preparing"], dropStatus: "Preparing" },
  { id: "applied", label: "Applied", statuses: ["Applied"], dropStatus: "Applied" },
  { id: "interviewing", label: "Interviewing", statuses: ["Screening", "Interview"], dropStatus: "Interview" },
  { id: "offer", label: "Offer", statuses: ["Offer"], dropStatus: "Offer" },
  { id: "rejected", label: "Rejected", statuses: ["Rejected"], dropStatus: "Rejected" },
  { id: "withdrawn", label: "Withdrawn", statuses: ["Withdrawn"], dropStatus: "Withdrawn" },
];

export const AFTER_APPLIED = ["Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"];
export const RESPONDED = ["Screening", "Interview", "Offer", "Rejected"];

export const today = () => new Date().toISOString().slice(0, 10);

export function loadApplications(): Application[] {
  const raw = getLocal<Application[]>(TRACKER_KEY, []);
  return Array.isArray(raw) ? raw.filter((a) => a && typeof a.id === "string").map((a) => ({ ...a, status: normalizeStatus(a.status) })) : [];
}

export function saveApplications(items: Application[]): void {
  setLocal(TRACKER_KEY, items);
  window.dispatchEvent(new Event("pd:tracker-changed"));
}

/** Changes status and records the change; a move to Applied sets the application date if none was set by the user. */
export function moveApplication(a: Application, status: string, now = new Date()): Application {
  if (a.status === status) return a;
  return {
    ...a,
    status,
    date: status === "Applied" && !a.date ? now.toISOString().slice(0, 10) : a.date,
    history: [...(a.history ?? []), { at: now.toISOString(), event: `Status changed from ${a.status} to ${status}` }],
  };
}

export function sourceOf(a: Application): "mine" | "board" | "autoapply" {
  if (a.source === "autoapply" || /AutoApply \(/.test(a.notes ?? "")) return "autoapply";
  if (a.jobId || (a.source && a.source !== "manual")) return "board";
  return "mine";
}

export function nextAction(a: Application, now = new Date()): string {
  const open = (a.reminders ?? []).filter((r) => !r.done && r.date).sort((x, y) => x.date.localeCompare(y.date))[0];
  if (open) return `${open.text || "Follow up"} · ${open.date}`;
  if (a.followUp) return `Follow up · ${a.followUp}`;
  const upcoming = (a.interviews ?? []).filter((i) => i.date && Date.parse(i.date) >= now.getTime() - 86_400_000).sort((x, y) => x.date.localeCompare(y.date))[0];
  if (upcoming) return `${upcoming.kind || "Interview"} · ${upcoming.date.slice(0, 10)}`;
  switch (a.status) {
    case "Saved": return "Decide whether to apply";
    case "Preparing": return "Finish and submit the application";
    case "Applied": return "Wait, then follow up";
    case "Screening": case "Interview": return "Prepare for the next round";
    case "Offer": return "Review the offer";
    default: return "—";
  }
}

export interface PipelineStats {
  total: number;
  byStage: Array<{ stage: string; count: number }>;
  applied: number;
  weekly: Array<{ weekStart: string; count: number }>;
  interviewRate: { value: number; of: number } | null;
  responseRate: { value: number; of: number } | null;
}

/** Minimum number of applications before a percentage is shown; below that a rate would be misleading. */
export const MIN_FOR_RATES = 5;

export function pipelineStats(items: Application[], now = new Date()): PipelineStats {
  const byStage = STAGES.map((stage) => ({ stage, count: items.filter((a) => a.status === stage).length }));
  const applied = items.filter((a) => AFTER_APPLIED.includes(a.status));
  const monday = (d: Date) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x;
  };
  const start = monday(now);
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const w = new Date(start);
    w.setUTCDate(w.getUTCDate() - (7 - i) * 7);
    return { weekStart: w.toISOString().slice(0, 10), count: 0 };
  });
  for (const a of applied) {
    // Activity is counted only for records that carry a real date.
    if (!a.date) continue;
    const t = monday(new Date(`${a.date}T00:00:00Z`)).toISOString().slice(0, 10);
    const slot = weekly.find((w) => w.weekStart === t);
    if (slot) slot.count += 1;
  }
  const enough = applied.length >= MIN_FOR_RATES;
  const interviewed = applied.filter((a) => a.status === "Interview" || a.status === "Offer" || (a.interviews?.length ?? 0) > 0).length;
  const responded = applied.filter((a) => RESPONDED.includes(a.status) || (a.interviews?.length ?? 0) > 0).length;
  return {
    total: items.length,
    byStage,
    applied: applied.length,
    weekly,
    interviewRate: enough ? { value: Math.round((interviewed / applied.length) * 100), of: applied.length } : null,
    responseRate: enough ? { value: Math.round((responded / applied.length) * 100), of: applied.length } : null,
  };
}

/* ---- pending review (records that may be missing from the tracker) ---- */

export interface ReviewState {
  dismissed: string[];
  confirmed: string[];
  /** Extension-reported records, cached so the banner survives reloads. */
  received: Array<{ queueId: string; company: string; role: string; url: string; evidence: string; receivedAt: string; trackerId?: string }>;
}

export const loadReview = (): ReviewState => ({ dismissed: [], confirmed: [], received: [], ...getLocal<Partial<ReviewState>>(REVIEW_KEY, {}) });
export const saveReview = (r: ReviewState) => setLocal(REVIEW_KEY, r);

/**
 * Applications that need a human decision: an autofill finished (or the page showed a confirmation) but
 * the user has not said whether it was submitted. Nothing is inferred. Each entry cites its evidence.
 */
export function pendingReviews(review: ReviewState, items: Application[]): ReviewState["received"] {
  const done = new Set([...review.dismissed, ...review.confirmed]);
  return review.received.filter((r) => {
    if (done.has(r.queueId)) return false;
    const rec = items.find((a) => a.id === r.trackerId || (a.url && a.url === r.url));
    return !rec || !AFTER_APPLIED.includes(rec.status);
  });
}
