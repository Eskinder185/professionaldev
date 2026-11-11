import { classifySite, sitePermissionPattern, type SiteAccess } from "./siteEligibility";

/**
 * "Always assist on this site": optional, per-site access the person grants and can revoke.
 *
 * Two modes exist:
 *  - Analyze this page: Chrome's activeTab. Granted by clicking the CareerOS toolbar button;
 *    it covers that one tab until it navigates or closes. No permanent permission.
 *  - Always assist on this site: a single https origin, requested at the moment of the click,
 *    plus a content script registered for just that origin. Revoking removes both.
 *
 * Nothing here requests all-sites access. Restricted site categories are refused before Chrome is
 * ever asked.
 */

export const ASSISTED_SITES_KEY = "careeros:assisted-sites";
const SCRIPT_PREFIX = "careeros-assist-";

export interface PermissionsApi {
  contains(p: { origins: string[] }): Promise<boolean>;
  request(p: { origins: string[] }): Promise<boolean>;
  remove(p: { origins: string[] }): Promise<boolean>;
}

export interface RegisteredScript {
  id: string;
  matches: string[];
  js: string[];
  runAt?: "document_start" | "document_end" | "document_idle";
  persistAcrossSessions?: boolean;
  allFrames?: boolean;
}

export interface ScriptingApi {
  registerContentScripts(scripts: RegisteredScript[]): Promise<void>;
  unregisterContentScripts(filter?: { ids?: string[] }): Promise<void>;
  getRegisteredContentScripts(filter?: { ids?: string[] }): Promise<RegisteredScript[]>;
}

export interface KeyValueStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface SiteAccessDeps {
  permissions: PermissionsApi;
  scripting: ScriptingApi;
  storage: KeyValueStorage;
}

/** Stable, short, id-safe name for a site's content script. */
export function scriptIdFor(pattern: string): string {
  let hash = 5381;
  for (const char of pattern) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return `${SCRIPT_PREFIX}${hash.toString(16)}`;
}

async function readSites(deps: SiteAccessDeps): Promise<string[]> {
  const value = (await deps.storage.get(ASSISTED_SITES_KEY))[ASSISTED_SITES_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const writeSites = (deps: SiteAccessDeps, sites: string[]) => deps.storage.set({ [ASSISTED_SITES_KEY]: Array.from(new Set(sites)).sort() });

async function ensureScript(deps: SiteAccessDeps, pattern: string): Promise<void> {
  const id = scriptIdFor(pattern);
  const existing = await deps.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) return;
  await deps.scripting.registerContentScripts([{ id, matches: [pattern], js: ["content.js"], runAt: "document_idle", persistAcrossSessions: true, allFrames: false }]);
}

async function dropScript(deps: SiteAccessDeps, pattern: string): Promise<void> {
  const id = scriptIdFor(pattern);
  const existing = await deps.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) await deps.scripting.unregisterContentScripts({ ids: [id] });
}

export type AssistState =
  /** CareerOS may not look at this page at all. */
  | { kind: "unavailable"; access: SiteAccess; message: string }
  /** The site restricts automated tools; CareerOS will not request ongoing access. */
  | { kind: "limited"; message: string }
  /** Access came with the install (for example Greenhouse and Lever). Chrome's extension settings can remove it. */
  | { kind: "built-in"; origin: string; message: string }
  /** The person granted ongoing access to this site. */
  | { kind: "always"; origin: string; pattern: string; message: string }
  /** Only the page the person opens CareerOS on. Ongoing access can be requested. */
  | { kind: "page-only"; origin: string; pattern: string; message: string };

export async function getAssistState(url: string | undefined | null, deps: SiteAccessDeps): Promise<AssistState> {
  const access = classifySite(url);
  if (access.status !== "ok") return { kind: "unavailable", access, message: access.message };
  const pattern = sitePermissionPattern(url);
  if (!pattern) {
    // Local development origins are covered at install; unsupported platforms are never requested.
    return access.platform === "unsupported"
      ? { kind: "limited", message: access.message }
      : { kind: "built-in", origin: access.origin, message: "Access to this address is part of the extension." };
  }
  const sites = await readSites(deps);
  const granted = await deps.permissions.contains({ origins: [pattern] }).catch(() => false);
  if (granted && sites.includes(pattern)) return { kind: "always", origin: access.origin, pattern, message: `CareerOS assists on ${access.hostname} until you turn it off.` };
  if (granted) return { kind: "built-in", origin: access.origin, message: `CareerOS already has access to ${access.hostname} from installation.` };
  return { kind: "page-only", origin: access.origin, pattern, message: `CareerOS reads ${access.hostname} only when you open it from the toolbar.` };
}

export type AssistResult =
  | { ok: true; message: string }
  | { ok: false; reason: "not-allowed" | "denied" | "error"; message: string };

/**
 * Must run from a click: Chrome only shows its permission prompt for a user gesture, and the
 * request is the first asynchronous step so the gesture is still valid.
 */
export async function enableAssist(url: string | undefined | null, deps: SiteAccessDeps): Promise<AssistResult> {
  const pattern = sitePermissionPattern(url);
  if (!pattern) {
    const access = classifySite(url);
    return { ok: false, reason: "not-allowed", message: access.status === "ok" ? "CareerOS can’t ask for ongoing access to this site." : access.message };
  }
  let granted: boolean;
  try {
    granted = await deps.permissions.request({ origins: [pattern] });
  } catch (error) {
    return { ok: false, reason: "error", message: error instanceof Error ? `Chrome couldn’t ask for access: ${error.message}` : "Chrome couldn’t ask for access." };
  }
  if (!granted) return { ok: false, reason: "denied", message: "Access wasn’t granted. CareerOS stays limited to the page you open it on." };
  try {
    await ensureScript(deps, pattern);
    await writeSites(deps, [...(await readSites(deps)), pattern]);
  } catch (error) {
    // Do not keep a permission we could not wire up.
    await deps.permissions.remove({ origins: [pattern] }).catch(() => undefined);
    return { ok: false, reason: "error", message: error instanceof Error ? `CareerOS couldn’t finish turning this on: ${error.message}` : "CareerOS couldn’t finish turning this on." };
  }
  return { ok: true, message: "CareerOS will assist on this site until you turn it off." };
}

export async function disableAssist(url: string | undefined | null, deps: SiteAccessDeps): Promise<AssistResult> {
  const pattern = sitePermissionPattern(url);
  if (!pattern) return { ok: false, reason: "not-allowed", message: "There’s no ongoing access to remove here." };
  try {
    await dropScript(deps, pattern);
    await deps.permissions.remove({ origins: [pattern] });
    await writeSites(deps, (await readSites(deps)).filter((site) => site !== pattern));
  } catch (error) {
    return { ok: false, reason: "error", message: error instanceof Error ? `CareerOS couldn’t turn this off: ${error.message}` : "CareerOS couldn’t turn this off." };
  }
  return { ok: true, message: "Ongoing access removed. CareerOS now only reads this site when you open it from the toolbar." };
}

/** Sites the person approved, for the settings list. */
export const listAssistedSites = (deps: SiteAccessDeps) => readSites(deps);

/**
 * Brings registered scripts, the saved list, and Chrome's actual permissions back into agreement.
 * Runs when the service worker starts and whenever a permission is removed (including from
 * Chrome's own settings), so a revoked site never keeps a script behind.
 * Returns the origins whose access has just disappeared.
 */
export async function reconcileAssistedSites(deps: SiteAccessDeps): Promise<{ active: string[]; revoked: string[] }> {
  const saved = await readSites(deps);
  const active: string[] = [];
  const revoked: string[] = [];
  for (const pattern of saved) {
    const granted = await deps.permissions.contains({ origins: [pattern] }).catch(() => false);
    if (granted) {
      await ensureScript(deps, pattern).catch(() => undefined);
      active.push(pattern);
    } else {
      await dropScript(deps, pattern).catch(() => undefined);
      revoked.push(pattern);
    }
  }
  // Scripts we registered for sites that are no longer in the list must not linger either.
  const registered = await deps.scripting.getRegisteredContentScripts().catch(() => [] as RegisteredScript[]);
  const known = new Set(saved.map(scriptIdFor));
  const orphans = registered.filter((script) => script.id.startsWith(SCRIPT_PREFIX) && !known.has(script.id)).map((script) => script.id);
  if (orphans.length) await deps.scripting.unregisterContentScripts({ ids: orphans }).catch(() => undefined);
  if (revoked.length) await writeSites(deps, active);
  return { active, revoked };
}
