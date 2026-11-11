import { handleExtensionMessage } from "../../../src/messaging/protocol";
import { loadExtensionState, saveExtensionState, type ExtensionPersistentState } from "../../../src/storage/stateStore";
import { selectPlatformAdapter } from "../../../src/adapters";
import { PLATFORM_ADAPTERS } from "../../../../../packages/careeros-shared/adapters";
import type { SiteAccessDeps } from "../../../src/page-intelligence/sitePermissions";
import type {
  AutoApplyMessage,
  AutoApplyResponse,
  MessageAction,
  PageContext,
  SharedProfileSubset,
  AutoApplyQueueItem,
} from "../../../../../packages/careeros-shared/types";

/* Minimal chrome typings: only what the panel uses. */
interface ChromeTab {
  id?: number;
  url?: string;
  title?: string;
  windowId?: number;
  active?: boolean;
}
interface ChromeLike {
  runtime?: {
    id?: string;
    sendMessage?: (msg: unknown, cb: (res: unknown) => void) => void;
    openOptionsPage?: () => void;
    lastError?: { message?: string };
    onMessage?: {
      addListener: (cb: (msg: unknown, sender: { tab?: { id?: number } }) => void) => void;
      removeListener: (cb: (msg: unknown, sender: { tab?: { id?: number } }) => void) => void;
    };
  };
  permissions?: SiteAccessDeps["permissions"];
  tabs?: {
    query: (q: Record<string, unknown>) => Promise<ChromeTab[]>;
    get: (id: number) => Promise<ChromeTab>;
    sendMessage: (id: number, msg: unknown) => Promise<unknown>;
    create: (p: { url: string }) => Promise<unknown>;
    update: (id: number, p: { active?: boolean }) => Promise<unknown>;
    captureVisibleTab?: (windowId?: number, options?: { format?: string; quality?: number }) => Promise<string>;
    onActivated?: { addListener: (cb: () => void) => void; removeListener: (cb: () => void) => void };
    onUpdated?: { addListener: (cb: (id: number, info: { status?: string; url?: string }) => void) => void; removeListener: (cb: (id: number, info: { status?: string; url?: string }) => void) => void };
  };
  scripting?: {
    executeScript: (o: { target: { tabId: number }; files: string[] }) => Promise<unknown>;
  } & Partial<SiteAccessDeps["scripting"]>;
  storage?: {
    local?: {
      get: (k: string) => Promise<Record<string, unknown>>;
      set: (o: Record<string, unknown>) => Promise<void>;
    };
    onChanged?: {
      addListener: (cb: (c: Record<string, unknown>, area: string) => void) => void;
      removeListener: (cb: (c: Record<string, unknown>, area: string) => void) => void;
    };
  };
}

export const chromeApi = (globalThis as unknown as { chrome?: ChromeLike }).chrome;
export const hasChrome = Boolean(chromeApi?.runtime?.id);

/** Sends a validated protocol message to the service worker (falls back to the local handler). */
export async function dispatch<T = unknown>(action: MessageAction, payload: unknown = {}): Promise<AutoApplyResponse<T>> {
  const msg: AutoApplyMessage = {
    protocol: "careeros-autoapply",
    version: "1.0",
    requestId: `sp-${action.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    origin: "extension://internal",
    timestamp: new Date().toISOString(),
    payload,
  };
  if (chromeApi?.runtime?.sendMessage) {
    return new Promise((resolve) => {
      try {
        chromeApi!.runtime!.sendMessage!(msg, (res) => {
          // Reading lastError clears the "unchecked runtime.lastError" warning when the worker is waking up.
          void chromeApi?.runtime?.lastError;
          if (res && typeof res === "object" && "ok" in (res as Record<string, unknown>)) {
            resolve(res as AutoApplyResponse<T>);
          } else {
            handleExtensionMessage(msg, { isInternalExtensionPage: true }).then((r) => resolve(r as AutoApplyResponse<T>));
          }
        });
      } catch {
        handleExtensionMessage(msg, { isInternalExtensionPage: true }).then((r) => resolve(r as AutoApplyResponse<T>));
      }
    });
  }
  return handleExtensionMessage(msg, { isInternalExtensionPage: true }) as Promise<AutoApplyResponse<T>>;
}

export const readState = loadExtensionState;

export function subscribeState(cb: () => void): () => void {
  const onChanged = chromeApi?.storage?.onChanged;
  if (!onChanged) return () => undefined;
  const handler = (_changes: Record<string, unknown>, area: string) => {
    if (area === "local") cb();
  };
  onChanged.addListener(handler);
  return () => onChanged.removeListener(handler);
}

export interface TargetTab {
  id?: number;
  url?: string;
  title?: string;
}

/**
 * The panel inspects the user's current page, never itself. `?tab=<id>` pins a tab (used by tests,
 * where the panel is opened as an ordinary tab); otherwise the active tab of the last focused window.
 */
export async function resolveTargetTab(): Promise<TargetTab | null> {
  const tabs = chromeApi?.tabs;
  if (!tabs) return null;
  const pinned = Number(new URLSearchParams(location.search).get("tab"));
  try {
    if (Number.isFinite(pinned) && pinned > 0) {
      const t = await tabs.get(pinned);
      return { id: t.id, url: t.url, title: t.title };
    }
    const list = await tabs.query({ active: true, lastFocusedWindow: true });
    const t = list.find((x) => !x.url || !/^(chrome-extension|chrome|edge|about):/.test(x.url));
    return t ? { id: t.id, url: t.url, title: t.title } : null;
  } catch {
    return null;
  }
}

export function subscribeTabs(cb: () => void): () => void {
  const tabs = chromeApi?.tabs;
  if (!tabs) return () => undefined;
  const onUpdated = (_id: number, info: { status?: string; url?: string }) => {
    if (info.status === "complete" || info.url) cb();
  };
  tabs.onActivated?.addListener(cb);
  tabs.onUpdated?.addListener(onUpdated);
  return () => {
    tabs.onActivated?.removeListener(cb);
    tabs.onUpdated?.removeListener(onUpdated);
  };
}

export function sendToTab<T = unknown>(tabId: number, msg: unknown): Promise<T> {
  return chromeApi!.tabs!.sendMessage(tabId, msg) as Promise<T>;
}

/** Context for a page we cannot read: derived from the URL only, with no job or field data. */
export function urlOnlyContext(url: string | undefined): PageContext {
  const adapter = selectPlatformAdapter(url ?? "about:blank");
  const spec = PLATFORM_ADAPTERS[adapter.id] ?? PLATFORM_ADAPTERS.generic;
  let hostname: string;
  try {
    hostname = url ? new URL(url).hostname : "";
  } catch {
    hostname = "";
  }
  return {
    supported: false,
    url: url ?? "",
    hostname,
    platform: adapter.id === "generic" ? "generic" : adapter.id,
    platformLabel: adapter.id === "generic" ? "Unrecognized site" : spec.label,
    supportLevel: adapter.supportLevel,
    job: null,
    pageStage: "page_detected",
    fields: [],
    coverLetter: { state: "none", field: null },
    needsSignIn: false,
    confirmed: false,
    validationIssues: [],
    detectedAt: new Date().toISOString(),
  };
}

export type PageReadResult =
  | { ok: true; context: PageContext }
  | { ok: false; reason: "no-tab" | "restricted" | "unreachable"; message: string; fallback: PageContext };

/** Asks the content script in the target tab for its page context, injecting it once if needed. */
export async function readPageContext(
  tab: TargetTab | null,
  profile: SharedProfileSubset | null,
  activeApplication: AutoApplyQueueItem | null,
): Promise<PageReadResult> {
  if (!tab?.id) {
    return { ok: false, reason: "no-tab", message: "No page to inspect. Open a job application in this window.", fallback: urlOnlyContext(undefined) };
  }
  if (tab.url && !/^https?:/.test(tab.url)) {
    return { ok: false, reason: "restricted", message: "Browsers don't allow extensions on this kind of page.", fallback: urlOnlyContext(tab.url) };
  }
  const ask = () =>
    sendToTab<{ ok?: boolean; context?: PageContext; error?: string }>(tab.id!, {
      careerosRequest: "GET_PAGE_CONTEXT",
      payload: { sharedProfile: profile, activeApplication },
    });
  const timeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  try {
    const res = await timeout(ask(), 4000);
    if (res?.ok && res.context) return { ok: true, context: res.context };
    throw new Error(res?.error ?? "No response");
  } catch {
    // Not injected on this site yet. activeTab (granted when the user opens the extension) allows one-time injection.
    try {
      await chromeApi!.scripting!.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const res = await timeout(ask(), 4000);
      if (res?.ok && res.context) return { ok: true, context: res.context };
    } catch {
      /* fall through */
    }
    return {
      ok: false,
      reason: "unreachable",
      message: "CareerOS can't read this page. Click the CareerOS toolbar icon on the page you want to apply on, then reopen the panel.",
      fallback: urlOnlyContext(tab.url),
    };
  }
}

export async function openUrl(url: string): Promise<void> {
  if (chromeApi?.tabs?.create) await chromeApi.tabs.create({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
}

export async function focusTab(tabId?: number): Promise<void> {
  if (tabId && chromeApi?.tabs?.update) await chromeApi.tabs.update(tabId, { active: true }).catch(() => undefined);
}

export function openSettings(): void {
  if (chromeApi?.runtime?.openOptionsPage) chromeApi.runtime.openOptionsPage();
  else window.open("../options/index.html", "_blank");
}

export async function allowDomain(host: string): Promise<void> {
  await saveExtensionState((prev: ExtensionPersistentState) => ({
    ...prev,
    allowedDomains: Array.from(new Set([...prev.allowedDomains, host.toLowerCase()])),
  }));
}

/* Lightweight UI preferences (separate from application data). */
const UI_KEY = "careeros:autoapply:ui";
export interface UiPrefs {
  tab: "page" | "ask" | "autofill" | "score" | "profile" | "ai";
  dismissed: string[];
  collapsed: Record<string, boolean>;
  overrides: Record<string, Record<string, "na" | "confirmed" | "reviewed">>;
  coverLetters: Array<{ id: string; name: string; text: string; updatedAt: string }>;
  coverDrafts: Record<string, { text: string; aiDrafted: boolean; reviewed: boolean }>;
  questionDrafts: Record<string, { answer: string; evidence: string; approved: boolean }>;
  /** Assistant drafts the person approved. Suggestions only; never applied to a résumé or form automatically. */
  approvedDrafts?: Array<{ url: string; text: string; approvedAt: string }>;
  /** An assistant action requested from another tab; the Ask tab runs its review step and clears this. */
  pendingAction?: "explain" | "qualify" | "missing" | "improve" | "answers" | "tailor";
}
export const defaultUi = (): UiPrefs => ({
  tab: "page",
  dismissed: [],
  collapsed: {},
  overrides: {},
  coverLetters: [],
  coverDrafts: {},
  questionDrafts: {},
});

export async function loadUi(): Promise<UiPrefs> {
  try {
    const raw = await chromeApi?.storage?.local?.get(UI_KEY);
    const v = raw?.[UI_KEY] as Partial<UiPrefs> | undefined;
    return { ...defaultUi(), ...(v ?? {}), questionDrafts: v?.questionDrafts ?? {} };
  } catch {
    return defaultUi();
  }
}
export async function saveUi(ui: UiPrefs): Promise<void> {
  try {
    await chromeApi?.storage?.local?.set({ [UI_KEY]: ui });
  } catch {
    /* preferences are best-effort */
  }
}
export async function clearUiData(): Promise<void> {
  await saveUi(defaultUi());
}

/** Chrome's permission, script-registration and storage APIs, for the Page Access card. */
export function siteAccessDeps(): SiteAccessDeps | null {
  const c = chromeApi;
  if (!c?.permissions || !c.scripting?.registerContentScripts || !c.scripting.unregisterContentScripts || !c.scripting.getRegisteredContentScripts || !c.storage?.local) return null;
  return {
    permissions: c.permissions,
    scripting: c.scripting as SiteAccessDeps["scripting"],
    storage: c.storage.local,
  };
}

/**
 * Notices from page scripts that a form on the watched tab changed. These replace timer polling:
 * the panel refreshes when the page says something changed, and at no other time.
 */
export function subscribePageEvents(tabId: number | undefined, cb: () => void): () => void {
  const onMessage = chromeApi?.runtime?.onMessage;
  if (!onMessage || tabId === undefined) return () => undefined;
  const handler = (msg: unknown, sender: { tab?: { id?: number } }) => {
    const event = (msg as { careerosEvent?: string } | null)?.careerosEvent;
    if ((event === "PAGE_CHANGED" || event === "HELLO") && sender.tab?.id === tabId) cb();
  };
  onMessage.addListener(handler);
  return () => onMessage.removeListener(handler);
}

/**
 * One picture of the visible part of the target tab, taken only because the person asked. Refuses
 * when that tab is not the one on screen (the picture would show something else) and explains
 * Chrome's own restriction in plain words.
 */
export async function captureVisibleTarget(tabId: number | undefined): Promise<string> {
  const tabs = chromeApi?.tabs;
  if (!tabs?.captureVisibleTab || tabId === undefined) throw new Error("This browser can’t capture the visible page from here.");
  const tab = await tabs.get(tabId);
  if (!tab.active) throw new Error("Switch to the page you want analysed so it’s the tab on screen, then try again.");
  try {
    return await tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 80 });
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    if (/activeTab|permission|cannot access|all_urls/i.test(text)) {
      throw Object.assign(new Error("Chrome only allows a capture after you click the CareerOS toolbar icon on this page. Click it, then try again."), { cause: error });
    }
    throw Object.assign(new Error("Chrome couldn’t capture this page."), { cause: error });
  }
}
