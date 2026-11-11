import type {
  AIConnectionSnapshot,
  AutofillRunState,
  AutoApplyQueueItem,
  ResumeAnalysisSnapshot,
  ResumeVersionSummary,
  DetectedField,
  PageStage,
  SharedProfileSubset,
} from "../../../../packages/careeros-shared/types";

export const EXT_STORAGE_KEY = "careeros:autoapply:ext-state";

export interface ExtensionPersistentState {
  version: "1.0";
  connectedOrigin: string | null;
  connectedAt: string | null;
  sharedProfile: SharedProfileSubset | null;
  queue: AutoApplyQueueItem[];
  activeApplicationId: string | null;
  currentTabUrl: string;
  currentTabPlatform: string;
  currentPageStage: PageStage;
  currentDetectedFields: DetectedField[];
  allowedDomains: string[];
  retentionDays: number;
  /** Analyses produced by the CareerOS website: applicationId -> resumeVersionId -> snapshot. */
  analyses: Record<string, Record<string, ResumeAnalysisSnapshot>>;
  resumeVersions: ResumeVersionSummary[];
  /** Non-secret description of the AI connection configured in CareerOS (never contains keys). */
  aiConnection: AIConnectionSnapshot | null;
  /** Profile keys edited inside the extension and not yet confirmed in CareerOS. */
  unconfirmedProfileFields: string[];
  lastSyncedAt: string | null;
  autofillRun: AutofillRunState | null;
  updatedAt: string;
}

export function defaultExtensionState(): ExtensionPersistentState {
  return {
    version: "1.0",
    connectedOrigin: null,
    connectedAt: null,
    sharedProfile: null,
    queue: [],
    activeApplicationId: null,
    currentTabUrl: "",
    currentTabPlatform: "generic",
    currentPageStage: "page_detected",
    currentDetectedFields: [],
    allowedDomains: [
      "127.0.0.1",
      "localhost",
      "boards.greenhouse.io",
      "job-boards.greenhouse.io",
      "jobs.lever.co",
    ],
    retentionDays: 30,
    analyses: {},
    resumeVersions: [],
    aiConnection: null,
    unconfirmedProfileFields: [],
    lastSyncedAt: null,
    autofillRun: null,
    updatedAt: new Date().toISOString(),
  };
}

let memoryFallbackState: ExtensionPersistentState = defaultExtensionState();

function hasChromeStorage(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as unknown as { chrome?: { storage?: { local?: unknown } } }).chrome?.storage?.local !==
      "undefined"
  );
}

/**
 * Loads extension state from chrome.storage.local (safe across MV3 service-worker restarts).
 */
export async function loadExtensionState(): Promise<ExtensionPersistentState> {
  if (!hasChromeStorage()) {
    return structuredClone(memoryFallbackState);
  }
  const chromeStorage = (
    globalThis as unknown as {
      chrome: { storage: { local: { get: (k: string) => Promise<Record<string, unknown>> } } };
    }
  ).chrome.storage.local;
  const raw = await chromeStorage.get(EXT_STORAGE_KEY);
  const stored = raw?.[EXT_STORAGE_KEY] as Partial<ExtensionPersistentState> | undefined;
  if (!stored || typeof stored !== "object") {
    return defaultExtensionState();
  }
  return {
    ...defaultExtensionState(),
    ...stored,
    queue: Array.isArray(stored.queue) ? stored.queue : [],
    currentDetectedFields: Array.isArray(stored.currentDetectedFields) ? stored.currentDetectedFields : [],
    resumeVersions: Array.isArray(stored.resumeVersions) ? stored.resumeVersions : [],
    unconfirmedProfileFields: Array.isArray(stored.unconfirmedProfileFields)
      ? stored.unconfirmedProfileFields
      : [],
    analyses: stored.analyses && typeof stored.analyses === "object" ? stored.analyses : {},
    allowedDomains: Array.isArray(stored.allowedDomains)
      ? stored.allowedDomains
      : defaultExtensionState().allowedDomains,
  };
}

/**
 * Saves extension state to chrome.storage.local.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Serialises read-modify-write cycles so concurrent messages (side panel, popup,
 * website bridge) can never overwrite each other's queue updates.
 */
export function saveExtensionState(
  updater:
    | Partial<ExtensionPersistentState>
    | ((prev: ExtensionPersistentState) => ExtensionPersistentState),
): Promise<ExtensionPersistentState> {
  const run = writeQueue.then(() => saveExtensionStateUnqueued(updater));
  writeQueue = run.catch(() => undefined);
  return run;
}

async function saveExtensionStateUnqueued(
  updater:
    | Partial<ExtensionPersistentState>
    | ((prev: ExtensionPersistentState) => ExtensionPersistentState),
): Promise<ExtensionPersistentState> {
  const prev = await loadExtensionState();
  const next: ExtensionPersistentState =
    typeof updater === "function"
      ? updater(prev)
      : {
          ...prev,
          ...updater,
          updatedAt: new Date().toISOString(),
        };
  next.updatedAt = new Date().toISOString();
  memoryFallbackState = structuredClone(next);

  if (hasChromeStorage()) {
    const chromeStorage = (
      globalThis as unknown as {
        chrome: { storage: { local: { set: (items: Record<string, unknown>) => Promise<void> } } };
      }
    ).chrome.storage.local;
    await chromeStorage.set({ [EXT_STORAGE_KEY]: next });
  }
  return next;
}

/**
 * Clears all shared profile and queue data from extension storage.
 */
export function clearExtensionState(): Promise<ExtensionPersistentState> {
  const run = writeQueue.then(clearUnqueued);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function clearUnqueued(): Promise<ExtensionPersistentState> {
  const fresh = defaultExtensionState();
  memoryFallbackState = structuredClone(fresh);
  if (hasChromeStorage()) {
    const chromeStorage = (
      globalThis as unknown as {
        chrome: { storage: { local: { set: (items: Record<string, unknown>) => Promise<void> } } };
      }
    ).chrome.storage.local;
    await chromeStorage.set({ [EXT_STORAGE_KEY]: fresh });
  }
  return fresh;
}
