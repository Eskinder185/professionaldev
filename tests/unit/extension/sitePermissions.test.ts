import { describe, expect, it } from "vitest";
import { classifySite, sitePermissionPattern } from "../../../apps/extension/src/page-intelligence/siteEligibility";
import {
  ASSISTED_SITES_KEY,
  disableAssist,
  enableAssist,
  getAssistState,
  reconcileAssistedSites,
  scriptIdFor,
  type RegisteredScript,
  type SiteAccessDeps,
} from "../../../apps/extension/src/page-intelligence/sitePermissions";

/** In-memory Chrome: permissions, registered scripts, and storage. */
function fakeChrome(options: { grant?: boolean; throwOnRequest?: boolean; builtIn?: string[] } = {}) {
  const granted = new Set<string>(options.builtIn ?? []);
  const scripts = new Map<string, RegisteredScript>();
  const store: Record<string, unknown> = {};
  const calls: string[] = [];
  const deps: SiteAccessDeps = {
    permissions: {
      contains: async ({ origins }) => origins.every((o) => granted.has(o)),
      request: async ({ origins }) => {
        calls.push(`request ${origins[0]}`);
        if (options.throwOnRequest) throw new Error("not from a user gesture");
        if (options.grant === false) return false;
        origins.forEach((o) => granted.add(o));
        return true;
      },
      remove: async ({ origins }) => {
        calls.push(`remove ${origins[0]}`);
        origins.forEach((o) => granted.delete(o));
        return true;
      },
    },
    scripting: {
      registerContentScripts: async (list) => list.forEach((s) => scripts.set(s.id, s)),
      unregisterContentScripts: async (filter) => (filter?.ids ?? [...scripts.keys()]).forEach((id) => scripts.delete(id)),
      getRegisteredContentScripts: async (filter) => [...scripts.values()].filter((s) => !filter?.ids || filter.ids.includes(s.id)),
    },
    storage: { get: async (key) => ({ [key]: store[key] }), set: async (items) => void Object.assign(store, items) },
  };
  return { deps, granted, scripts, store, calls };
}

describe("classifySite", () => {
  it("reads ordinary https sites and recognises supported applicant systems", () => {
    expect(classifySite("https://boards.greenhouse.io/acme/jobs/1")).toMatchObject({ status: "ok", platform: "greenhouse", knownApplicantSystem: true });
    expect(classifySite("https://careers.example.com/jobs/42")).toMatchObject({ status: "ok", knownApplicantSystem: false, origin: "https://careers.example.com" });
  });

  it("explains browser pages and other schemes instead of failing silently", () => {
    expect(classifySite("chrome://extensions")).toMatchObject({ status: "browser-page" });
    expect(classifySite("chrome-extension://abc/popup.html")).toMatchObject({ status: "browser-page" });
    expect(classifySite("about:blank")).toMatchObject({ status: "browser-page" });
    expect(classifySite("file:///C:/resume.pdf")).toMatchObject({ status: "unsupported-scheme" });
    expect(classifySite("ftp://example.com/x")).toMatchObject({ status: "unsupported-scheme" });
    expect(classifySite(undefined)).toMatchObject({ status: "invalid" });
  });

  it("refuses plain http except on this computer", () => {
    expect(classifySite("http://jobs.example.com/apply")).toMatchObject({ status: "insecure" });
    expect(classifySite("http://127.0.0.1:4173/professionaldev/")).toMatchObject({ status: "ok" });
  });

  it("refuses banking, email, password, health, and sign-in sites, with a reason", () => {
    for (const [url, category] of [
      ["https://www.chase.com/personal/online", "banking"],
      ["https://secure.bankofamerica.com/login", "banking"],
      ["https://mail.google.com/mail/u/0", "email"],
      ["https://outlook.live.com/mail", "email"],
      ["https://vault.bitwarden.com/", "password-manager"],
      ["https://my.1password.com/", "password-manager"],
      ["https://www.kp.org/", "health"],
      ["https://accounts.google.com/signin", "identity"],
    ] as const) {
      const access = classifySite(url);
      expect(access, url).toMatchObject({ status: "restricted", category });
      expect(access.message).toMatch(/doesn.t read these/);
    }
  });

  it("still reads a bank's careers page, because that is a job posting, not an account", () => {
    expect(classifySite("https://careers.bankofamerica.com/en-us/job-detail/123")).toMatchObject({ status: "ok" });
    expect(classifySite("https://jobs.chase.com/")).toMatchObject({ status: "ok" });
  });

  it("marks gated job boards as unsupported without claiming support", () => {
    const access = classifySite("https://www.linkedin.com/jobs/view/123");
    expect(access).toMatchObject({ status: "ok", platform: "unsupported" });
    expect(access.message).toMatch(/limits automated help/);
    expect(sitePermissionPattern("https://www.linkedin.com/jobs/view/123")).toBeNull();
  });

  it("builds a single-origin permission pattern, never an all-sites one", () => {
    expect(sitePermissionPattern("https://careers.example.com/jobs/42?x=1")).toBe("https://careers.example.com/*");
    expect(sitePermissionPattern("https://www.chase.com/")).toBeNull();
    expect(sitePermissionPattern("http://127.0.0.1:4173/x")).toBeNull();
    expect(sitePermissionPattern("chrome://settings")).toBeNull();
    expect(sitePermissionPattern("https://careers.example.com/")).not.toMatch(/\*:\/\/\*|<all_urls>|https:\/\/\*\//);
  });
});

describe("always assist on this site", () => {
  const url = "https://careers.example.com/jobs/42";
  const pattern = "https://careers.example.com/*";

  it("starts as page-only, then grants, registers a script for that origin only, and remembers it", async () => {
    const { deps, scripts, store } = fakeChrome();
    expect((await getAssistState(url, deps)).kind).toBe("page-only");
    const result = await enableAssist(url, deps);
    expect(result.ok).toBe(true);
    expect((await getAssistState(url, deps)).kind).toBe("always");
    expect([...scripts.values()]).toEqual([expect.objectContaining({ id: scriptIdFor(pattern), matches: [pattern], js: ["content.js"], persistAcrossSessions: true, allFrames: false })]);
    expect(store[ASSISTED_SITES_KEY]).toEqual([pattern]);
  });

  it("leaves nothing behind when the person declines", async () => {
    const { deps, scripts, store } = fakeChrome({ grant: false });
    const result = await enableAssist(url, deps);
    expect(result).toMatchObject({ ok: false, reason: "denied" });
    expect(result.message).toMatch(/limited to the page you open it on/);
    expect(scripts.size).toBe(0);
    expect(store[ASSISTED_SITES_KEY]).toBeUndefined();
    expect((await getAssistState(url, deps)).kind).toBe("page-only");
  });

  it("reports Chrome refusing the request (no user gesture) instead of pretending", async () => {
    const { deps } = fakeChrome({ throwOnRequest: true });
    expect(await enableAssist(url, deps)).toMatchObject({ ok: false, reason: "error" });
  });

  it("never asks Chrome about restricted or unsupported sites", async () => {
    const { deps, calls } = fakeChrome();
    for (const blocked of ["https://www.chase.com/", "https://mail.google.com/", "https://www.linkedin.com/jobs/view/1", "chrome://settings", "http://jobs.example.com/"]) {
      expect(await enableAssist(blocked, deps), blocked).toMatchObject({ ok: false, reason: "not-allowed" });
    }
    expect(calls).toEqual([]);
  });

  it("revokes the permission, the script, and the saved entry", async () => {
    const { deps, scripts, store, granted } = fakeChrome();
    await enableAssist(url, deps);
    const result = await disableAssist(url, deps);
    expect(result.ok).toBe(true);
    expect(scripts.size).toBe(0);
    expect(store[ASSISTED_SITES_KEY]).toEqual([]);
    expect(granted.has(pattern)).toBe(false);
    expect((await getAssistState(url, deps)).kind).toBe("page-only");
  });

  it("undoes the permission if wiring it up fails, so no half-enabled site remains", async () => {
    const { deps, granted } = fakeChrome();
    deps.scripting.registerContentScripts = async () => {
      throw new Error("register failed");
    };
    expect(await enableAssist(url, deps)).toMatchObject({ ok: false, reason: "error" });
    expect(granted.has(pattern)).toBe(false);
  });

  it("treats install-time access as built-in, not as something CareerOS granted", async () => {
    const { deps } = fakeChrome({ builtIn: ["https://boards.greenhouse.io/*"] });
    expect((await getAssistState("https://boards.greenhouse.io/acme/jobs/1", deps)).kind).toBe("built-in");
  });

  it("explains unsupported pages through the same state", async () => {
    const { deps } = fakeChrome();
    expect(await getAssistState("chrome://settings", deps)).toMatchObject({ kind: "unavailable" });
    expect(await getAssistState("https://www.linkedin.com/jobs/view/1", deps)).toMatchObject({ kind: "limited" });
  });
});

describe("reconcile after a service-worker restart or a revocation from Chrome settings", () => {
  const a = "https://a.example.com/*";
  const b = "https://b.example.com/*";

  it("removes the script and entry for a site whose permission is gone, and keeps the rest", async () => {
    const { deps, granted, scripts, store } = fakeChrome();
    await enableAssist("https://a.example.com/jobs/1", deps);
    await enableAssist("https://b.example.com/jobs/1", deps);
    granted.delete(a); // revoked in chrome://extensions
    const result = await reconcileAssistedSites(deps);
    expect(result).toEqual({ active: [b], revoked: [a] });
    expect([...scripts.keys()]).toEqual([scriptIdFor(b)]);
    expect(store[ASSISTED_SITES_KEY]).toEqual([b]);
  });

  it("re-registers a script that was lost while the permission is still granted", async () => {
    const { deps, scripts } = fakeChrome();
    await enableAssist("https://a.example.com/jobs/1", deps);
    scripts.clear();
    await reconcileAssistedSites(deps);
    expect(scripts.has(scriptIdFor(a))).toBe(true);
  });

  it("removes stray CareerOS scripts for sites that are no longer approved, and leaves others alone", async () => {
    const { deps, scripts } = fakeChrome();
    scripts.set(scriptIdFor("https://old.example.com/*"), { id: scriptIdFor("https://old.example.com/*"), matches: ["https://old.example.com/*"], js: ["content.js"] });
    scripts.set("someone-elses-script", { id: "someone-elses-script", matches: ["https://x/*"], js: ["x.js"] });
    await reconcileAssistedSites(deps);
    expect([...scripts.keys()]).toEqual(["someone-elses-script"]);
  });
});
