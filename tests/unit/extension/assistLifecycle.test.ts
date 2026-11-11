import { describe, expect, it } from "vitest";
import { TAB_REGISTRY_KEY, forgetTab, handleCareerosEvent, isCareerosEvent, reconcileAndNotify, type LifecycleChrome } from "../../../apps/extension/src/page-intelligence/assistLifecycle";
import { ASSISTED_SITES_KEY, enableAssist, type RegisteredScript, type SiteAccessDeps } from "../../../apps/extension/src/page-intelligence/sitePermissions";

function fakeEnv() {
  const granted = new Set<string>();
  const scripts = new Map<string, RegisteredScript>();
  const local: Record<string, unknown> = {};
  const session: Record<string, unknown> = {};
  const messages: Array<{ tabId: number; message: unknown }> = [];
  const deps: SiteAccessDeps = {
    permissions: {
      contains: async ({ origins }) => origins.every((o) => granted.has(o)),
      request: async ({ origins }) => (origins.forEach((o) => granted.add(o)), true),
      remove: async ({ origins }) => (origins.forEach((o) => granted.delete(o)), true),
    },
    scripting: {
      registerContentScripts: async (list) => list.forEach((s) => scripts.set(s.id, s)),
      unregisterContentScripts: async (f) => (f?.ids ?? [...scripts.keys()]).forEach((id) => scripts.delete(id)),
      getRegisteredContentScripts: async (f) => [...scripts.values()].filter((s) => !f?.ids || f.ids.includes(s.id)),
    },
    storage: { get: async (k) => ({ [k]: local[k] }), set: async (items) => void Object.assign(local, items) },
  };
  const env: LifecycleChrome = {
    deps,
    session: { get: async (k) => ({ [k]: session[k] }), set: async (items) => void Object.assign(session, items) },
    sendToTab: async (tabId, message) => void messages.push({ tabId, message }),
  };
  return { env, deps, granted, session, local, messages };
}

describe("page script registration", () => {
  it("tracks a tab only when the person approved ongoing access to that site", async () => {
    const { env, deps, session } = fakeEnv();
    await enableAssist("https://a.example.com/jobs/1", deps);
    expect(await handleCareerosEvent({ careerosEvent: "HELLO" }, { tab: { id: 7, url: "https://a.example.com/jobs/1" } }, env)).toBe("registered");
    expect(await handleCareerosEvent({ careerosEvent: "HELLO" }, { tab: { id: 8, url: "https://b.example.com/jobs/1" } }, env)).toBe("ignored");
    expect(await handleCareerosEvent({ careerosEvent: "HELLO" }, { tab: { id: 9, url: "https://www.chase.com/" } }, env)).toBe("ignored");
    expect(session[TAB_REGISTRY_KEY]).toEqual({ "7": "https://a.example.com/*" });
  });

  it("ignores page-change notices and anything without a tab", async () => {
    const { env } = fakeEnv();
    expect(await handleCareerosEvent({ careerosEvent: "PAGE_CHANGED" }, { tab: { id: 1, url: "https://a.example.com/" } }, env)).toBe("ignored");
    expect(await handleCareerosEvent({ careerosEvent: "HELLO" }, {}, env)).toBe("ignored");
  });

  it("recognises only well-formed events", () => {
    expect(isCareerosEvent({ careerosEvent: "HELLO" })).toBe(true);
    expect(isCareerosEvent({ action: "HANDSHAKE" })).toBe(false);
    expect(isCareerosEvent(null)).toBe(false);
  });

  it("forgets a closed tab", async () => {
    const { env, deps, session } = fakeEnv();
    await enableAssist("https://a.example.com/jobs/1", deps);
    await handleCareerosEvent({ careerosEvent: "HELLO" }, { tab: { id: 7, url: "https://a.example.com/jobs/1" } }, env);
    await forgetTab(7, env);
    expect(session[TAB_REGISTRY_KEY]).toEqual({});
  });
});

describe("revocation shuts down open tabs", () => {
  it("tells only the tabs on the revoked site to deactivate, then forgets them", async () => {
    const { env, deps, granted, messages, session } = fakeEnv();
    await enableAssist("https://a.example.com/jobs/1", deps);
    await enableAssist("https://b.example.com/jobs/1", deps);
    await handleCareerosEvent({ careerosEvent: "HELLO" }, { tab: { id: 1, url: "https://a.example.com/jobs/1" } }, env);
    await handleCareerosEvent({ careerosEvent: "HELLO" }, { tab: { id: 2, url: "https://a.example.com/jobs/2" } }, env);
    await handleCareerosEvent({ careerosEvent: "HELLO" }, { tab: { id: 3, url: "https://b.example.com/jobs/1" } }, env);

    granted.delete("https://a.example.com/*"); // removed from chrome://extensions
    const result = await reconcileAndNotify(env);

    expect(result).toMatchObject({ revoked: ["https://a.example.com/*"], active: ["https://b.example.com/*"], notified: 2 });
    expect(messages).toEqual([
      { tabId: 1, message: { careerosRequest: "DEACTIVATE" } },
      { tabId: 2, message: { careerosRequest: "DEACTIVATE" } },
    ]);
    expect(session[TAB_REGISTRY_KEY]).toEqual({ "3": "https://b.example.com/*" });
  });

  it("does nothing when nothing was revoked, so a worker restart is cheap and quiet", async () => {
    const { env, deps, messages } = fakeEnv();
    await enableAssist("https://a.example.com/jobs/1", deps);
    expect(await reconcileAndNotify(env)).toMatchObject({ revoked: [], notified: 0 });
    expect(messages).toEqual([]);
  });

  it("survives a tab that has already gone away", async () => {
    const { env, deps, granted } = fakeEnv();
    await enableAssist("https://a.example.com/jobs/1", deps);
    await handleCareerosEvent({ careerosEvent: "HELLO" }, { tab: { id: 1, url: "https://a.example.com/jobs/1" } }, env);
    env.sendToTab = async () => {
      throw new Error("No tab with id 1");
    };
    granted.clear();
    await expect(reconcileAndNotify(env)).resolves.toMatchObject({ revoked: ["https://a.example.com/*"] });
  });

  it("restores a registered script that was lost across a worker restart", async () => {
    const { env, deps } = fakeEnv();
    await enableAssist("https://a.example.com/jobs/1", deps);
    await deps.scripting.unregisterContentScripts();
    await reconcileAndNotify(env);
    expect((await deps.scripting.getRegisteredContentScripts()).length).toBe(1);
    expect((env.deps.storage as unknown as { get(k: string): Promise<Record<string, unknown>> }).get).toBeDefined();
    expect((await deps.storage.get(ASSISTED_SITES_KEY))[ASSISTED_SITES_KEY]).toEqual(["https://a.example.com/*"]);
  });
});
