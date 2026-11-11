import { useCallback, useEffect, useState } from "react";
import { getLocal, setLocal } from "../../hooks/useLocal";
import { fetchBoard, prettifyToken } from "./connectors";
import {
  JOB_STORE_KEY,
  LEGACY_JOBS_KEY,
  LEGACY_SEARCHES_KEY,
  emptyFilters,
  emptyPrefs,
  emptyStore,
  migrateLegacyJob,
  type BoardConnection,
  type JobFilters,
  type JobPosting,
  type JobStoreState,
  type LegacyJob,
} from "./schema";

const EVENT = "pd:jobs-store-changed";

/** Loads v2 state; the first time, converts the legacy manual library without deleting it. */
export function loadJobStore(): JobStoreState {
  const stored = getLocal<Partial<JobStoreState> | null>(JOB_STORE_KEY, null);
  if (stored && stored.version === 2) {
    return { ...emptyStore(), ...stored, feedback: { liked: [], disliked: [], ...(stored.feedback ?? {}) }, prefs: { ...emptyPrefs(), ...(stored.prefs ?? {}) } } as JobStoreState;
  }
  const next = emptyStore();
  const legacy = getLocal<LegacyJob[]>(LEGACY_JOBS_KEY, []);
  if (Array.isArray(legacy)) {
    for (const j of legacy) {
      if (!j || typeof j.id !== "string" || !j.title || !j.company) continue;
      next.postings[j.id] = migrateLegacyJob(j);
      next.saved.push(j.id);
    }
  }
  const searches = getLocal<Array<{ id: string; query: string; arrangement: string }>>(LEGACY_SEARCHES_KEY, []);
  if (Array.isArray(searches)) {
    for (const s of searches) {
      if (!s?.id) continue;
      next.searches.push({
        id: s.id,
        name: s.query || "Saved search",
        filters: { ...blankFilters(), query: s.query ?? "", arrangement: /remote/i.test(s.arrangement) ? "remote" : /hybrid/i.test(s.arrangement) ? "hybrid" : /on-?site/i.test(s.arrangement) ? "onsite" : "any" },
      });
    }
  }
  setLocal(JOB_STORE_KEY, next);
  return next;
}

const blankFilters = (): JobFilters => emptyFilters();

export function saveJobStore(state: JobStoreState): void {
  setLocal(JOB_STORE_KEY, state);
  window.dispatchEvent(new Event(EVENT));
}

export function updateJobStore(fn: (s: JobStoreState) => JobStoreState): JobStoreState {
  const next = fn(loadJobStore());
  saveJobStore(next);
  return next;
}

export function useJobStore() {
  const [state, setState] = useState<JobStoreState>(loadJobStore);
  useEffect(() => {
    const sync = () => setState(loadJobStore());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((fn: (s: JobStoreState) => JobStoreState) => setState(updateJobStore(fn)), []);
  return { state, update };
}

/* ---- pure state transitions (unit-tested) ---- */

export const toggleSaved = (s: JobStoreState, id: string): JobStoreState => ({
  ...s,
  saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [id, ...s.saved],
  dismissed: s.dismissed.filter((x) => x !== id),
});

export const dismiss = (s: JobStoreState, id: string): JobStoreState => ({
  ...s,
  dismissed: Array.from(new Set([...s.dismissed, id])),
  saved: s.saved.filter((x) => x !== id),
});

export const restore = (s: JobStoreState, id: string): JobStoreState => ({ ...s, dismissed: s.dismissed.filter((x) => x !== id) });

export function addPosting(s: JobStoreState, p: JobPosting, save = true): JobStoreState {
  return { ...s, postings: { ...s.postings, [p.id]: p }, saved: save && !s.saved.includes(p.id) ? [p.id, ...s.saved] : s.saved };
}

export function removePosting(s: JobStoreState, id: string): JobStoreState {
  const { [id]: _removed, ...rest } = s.postings;
  const { [id]: _t, ...tracked } = s.tracked;
  void _removed;
  void _t;
  return { ...s, postings: rest, saved: s.saved.filter((x) => x !== id), dismissed: s.dismissed.filter((x) => x !== id), tracked };
}

/**
 * Replaces a board's listings with a fresh fetch. Listings the user saved or tracked are kept even if
 * the employer removed them, so the user's data is never silently lost.
 */
export function applyBoardFetch(s: JobStoreState, board: BoardConnection, jobs: JobPosting[]): JobStoreState {
  const keep = new Set([...s.saved, ...Object.keys(s.tracked)]);
  const postings: Record<string, JobPosting> = {};
  for (const [id, p] of Object.entries(s.postings)) if (p.boardId !== board.id || keep.has(id)) postings[id] = p;
  for (const j of jobs) {
    const prev = s.postings[j.id];
    postings[j.id] = { ...j, addedAt: prev?.addedAt ?? j.addedAt };
  }
  const boards = s.boards.map((b) => (b.id === board.id ? { ...board, count: jobs.length, lastFetchedAt: new Date().toISOString(), lastError: null } : b));
  return { ...s, postings, boards };
}

export function setFeedback(s: JobStoreState, id: string, value: "like" | "dislike" | "clear"): JobStoreState {
  const liked = s.feedback.liked.filter((x) => x !== id);
  const disliked = s.feedback.disliked.filter((x) => x !== id);
  if (value === "like") liked.push(id);
  if (value === "dislike") disliked.push(id);
  return { ...s, feedback: { liked, disliked } };
}

export async function connectBoard(
  s: JobStoreState,
  kind: BoardConnection["kind"],
  token: string,
  fetchImpl?: typeof fetch,
): Promise<JobStoreState> {
  const id = `${kind}:${token}`;
  if (s.boards.some((b) => b.id === id)) throw new Error("That board is already connected.");
  const { companyName, jobs } = await fetchBoard(kind, token, fetchImpl);
  const name = companyName && companyName !== token ? companyName : prettifyToken(token);
  const board: BoardConnection = { id, kind, token, companyName: name, lastFetchedAt: null, lastError: null, count: 0 };
  // Feeds that don't name the company get the display name here.
  const named = jobs.map((j) => (j.company === token ? { ...j, company: name } : j));
  return applyBoardFetch({ ...s, boards: [...s.boards, board] }, board, named);
}

export async function refreshBoard(s: JobStoreState, boardId: string, fetchImpl?: typeof fetch): Promise<JobStoreState> {
  const board = s.boards.find((b) => b.id === boardId);
  if (!board) return s;
  try {
    const { jobs } = await fetchBoard(board.kind, board.token, fetchImpl);
    const named = jobs.map((j) => (j.company === board.token ? { ...j, company: board.companyName } : j));
    return applyBoardFetch(s, board, named);
  } catch (e) {
    return { ...s, boards: s.boards.map((b) => (b.id === boardId ? { ...b, lastError: e instanceof Error ? e.message : "Refresh failed." } : b)) };
  }
}

export function removeBoard(s: JobStoreState, boardId: string): JobStoreState {
  const keep = new Set([...s.saved, ...Object.keys(s.tracked)]);
  const postings: Record<string, JobPosting> = {};
  for (const [id, p] of Object.entries(s.postings)) if (p.boardId !== boardId || keep.has(id)) postings[id] = p;
  return { ...s, boards: s.boards.filter((b) => b.id !== boardId), postings };
}
