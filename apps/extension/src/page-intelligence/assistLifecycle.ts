import { sitePermissionPattern } from "./siteEligibility";
import { ASSISTED_SITES_KEY, reconcileAssistedSites, type SiteAccessDeps } from "./sitePermissions";

/**
 * Keeps "always assist" honest across the browser's lifecycle.
 *
 * - Service workers are shut down and restarted by Chrome whenever it likes, so nothing is kept in
 *   memory: the list of approved sites is in storage, and a short registry of tabs that currently
 *   have the page script lives in session storage.
 * - When a site's permission disappears (the person turned it off here, or removed it in Chrome's
 *   extension settings), every open tab on that site is told to shut its page script down, so no
 *   privileged page connection outlives the permission.
 */

export const TAB_REGISTRY_KEY = "careeros:assist-tabs";

export interface LifecycleChrome {
  deps: SiteAccessDeps;
  /** Session-scoped storage (cleared when the browser closes); local storage is the fallback. */
  session: { get(key: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> };
  sendToTab(tabId: number, message: unknown): Promise<unknown>;
}

type Registry = Record<string, string>;

async function readRegistry(env: LifecycleChrome): Promise<Registry> {
  const value = (await env.session.get(TAB_REGISTRY_KEY))[TAB_REGISTRY_KEY];
  return value && typeof value === "object" ? (value as Registry) : {};
}
const writeRegistry = (env: LifecycleChrome, registry: Registry) => env.session.set({ [TAB_REGISTRY_KEY]: registry });

export interface CareerosEvent {
  careerosEvent: "HELLO" | "PAGE_CHANGED";
  url?: string;
}

export const isCareerosEvent = (value: unknown): value is CareerosEvent =>
  Boolean(value) && typeof value === "object" && typeof (value as { careerosEvent?: unknown }).careerosEvent === "string";

/** A page script announces itself. It is tracked only if the person approved ongoing access to that site. */
export async function handleCareerosEvent(event: CareerosEvent, sender: { tab?: { id?: number; url?: string } }, env: LifecycleChrome): Promise<"registered" | "ignored"> {
  if (event.careerosEvent !== "HELLO" || typeof sender.tab?.id !== "number") return "ignored";
  const pattern = sitePermissionPattern(sender.tab.url ?? event.url);
  if (!pattern) return "ignored";
  const approved = (await env.deps.storage.get(ASSISTED_SITES_KEY))[ASSISTED_SITES_KEY];
  if (!Array.isArray(approved) || !approved.includes(pattern)) return "ignored";
  const registry = await readRegistry(env);
  registry[String(sender.tab.id)] = pattern;
  await writeRegistry(env, registry);
  return "registered";
}

export async function forgetTab(tabId: number, env: LifecycleChrome): Promise<void> {
  const registry = await readRegistry(env);
  if (String(tabId) in registry) {
    delete registry[String(tabId)];
    await writeRegistry(env, registry);
  }
}

/** Reconcile permissions, then shut down page scripts on every site whose access is gone. */
export async function reconcileAndNotify(env: LifecycleChrome): Promise<{ active: string[]; revoked: string[]; notified: number }> {
  const { active, revoked } = await reconcileAssistedSites(env.deps);
  let notified = 0;
  if (revoked.length) {
    const registry = await readRegistry(env);
    for (const [tabId, pattern] of Object.entries(registry)) {
      if (!revoked.includes(pattern)) continue;
      await env.sendToTab(Number(tabId), { careerosRequest: "DEACTIVATE" }).catch(() => undefined);
      delete registry[tabId];
      notified += 1;
    }
    await writeRegistry(env, registry);
  }
  return { active, revoked, notified };
}

/* ---- Wiring to the real chrome object (not exercised by unit tests; covered in real Chromium). ---- */

interface RealChrome {
  permissions?: SiteAccessDeps["permissions"] & { onRemoved?: { addListener(cb: () => void): void } };
  scripting?: SiteAccessDeps["scripting"];
  storage?: { local?: SiteAccessDeps["storage"]; session?: LifecycleChrome["session"] };
  tabs?: { sendMessage(id: number, message: unknown): Promise<unknown>; onRemoved?: { addListener(cb: (id: number) => void): void } };
  runtime?: { onStartup?: { addListener(cb: () => void): void }; onInstalled?: { addListener(cb: () => void): void } };
}

export function realLifecycleEnv(root: unknown = (globalThis as { chrome?: unknown }).chrome): LifecycleChrome | null {
  const c = root as RealChrome | undefined;
  if (!c?.permissions || !c.scripting || !c.storage?.local || !c.tabs) return null;
  return {
    deps: { permissions: c.permissions, scripting: c.scripting, storage: c.storage.local },
    session: c.storage.session ?? c.storage.local,
    sendToTab: (id, message) => c.tabs!.sendMessage(id, message),
  };
}

export function initAssistLifecycle(root: unknown = (globalThis as { chrome?: unknown }).chrome): LifecycleChrome | null {
  const env = realLifecycleEnv(root);
  const c = root as RealChrome | undefined;
  if (!env || !c) return null;
  const run = () => void reconcileAndNotify(env).catch(() => undefined);
  run(); // every time the service worker starts
  c.permissions?.onRemoved?.addListener(run);
  c.runtime?.onStartup?.addListener(run);
  c.runtime?.onInstalled?.addListener(run);
  c.tabs?.onRemoved?.addListener((id) => void forgetTab(id, env).catch(() => undefined));
  return env;
}
