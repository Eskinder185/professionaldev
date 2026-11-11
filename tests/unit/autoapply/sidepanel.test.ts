import { beforeEach, describe, expect, it } from "vitest";
import { detectPageContext, detectCoverLetter, extractJobInfo } from "../../../apps/extension/src/detect/pageContext";
import { handleExtensionMessage } from "../../../apps/extension/src/messaging/protocol";
import { clearExtensionState, loadExtensionState, saveExtensionState } from "../../../apps/extension/src/storage/stateStore";
import { classifyField, autoFillableIds } from "../../../apps/extension/entrypoints/sidepanel/lib/autofill";
import { aiAvailability } from "../../../apps/extension/entrypoints/sidepanel/lib/ai";
import { effectiveCounts, matchApplication } from "../../../apps/extension/entrypoints/sidepanel/lib/model";
import { buildAnalysisSnapshot } from "../../../src/features/autoapply/analysisSync";
import { defaultMasterResume } from "../../../src/features/autoapply/storage";
import { defaultSettings, newVersion } from "../../../src/features/resume/model/defaults";
import type { AutoApplyQueueItem, DetectedField } from "../../../packages/careeros-shared/types";

const SITE = "http://localhost/professionaldev/autoapply";
const msg = (action: string, payload: unknown, origin = "extension://internal") => ({
  protocol: "careeros-autoapply",
  version: "1.0",
  requestId: `t-${Math.random().toString(36).slice(2)}`,
  action,
  origin,
  timestamp: new Date().toISOString(),
  payload,
});

function page(html: string) {
  document.head.innerHTML = "";
  document.body.innerHTML = html;
  return document;
}

describe("page detection", () => {
  it("reads job info only from evidence on the page", () => {
    const doc = page(`
      <script type="application/ld+json">{"@type":"JobPosting","title":"Software Engineer I","hiringOrganization":{"name":"Example Co"},
        "jobLocation":{"address":{"addressLocality":"Atlanta","addressRegion":"GA"}},
        "baseSalary":{"currency":"USD","value":{"minValue":85000,"maxValue":105000,"unitText":"YEAR"}}}</script>
      <h1>Software Engineer I</h1>`);
    const job = extractJobInfo(doc, "https://example.com/j/1", "generic", "Generic")!;
    expect(job).toMatchObject({ title: "Software Engineer I", company: "Example Co", location: "Atlanta, GA" });
    expect(job.salary).toBe("$85,000–$105,000 / year");
    expect(job.closedEvidence).toBeNull();
  });

  it("never invents salary, company or an active status", () => {
    const doc = page(`<h1>Linux Engineer — Acme</h1><form><input name="email" /></form>`);
    const job = extractJobInfo(doc, "https://acme.test/apply", "generic", "Generic", true)!;
    expect(job.company).toBe("Acme");
    expect(job.salary).toBeNull();
    expect(job.closedEvidence).toBeNull();
  });

  it("does not turn an ordinary page into a job card", () => {
    const doc = page(`<h1>My cat photos</h1><p>Hello</p>`);
    expect(extractJobInfo(doc, "https://blog.test/", "generic", "Generic", false)).toBeNull();
    const withForm = page(`<h1>Contact us</h1><form><input name="email"/></form>`);
    expect(extractJobInfo(withForm, "https://blog.test/contact", "generic", "Generic", true)).toBeNull();
  });

  it("reports closed postings only when the page says so", () => {
    const doc = page(`<h1>Role — Acme</h1><p>This job is no longer available.</p>`);
    const job = extractJobInfo(doc, "https://boards.greenhouse.io/acme/jobs/1", "greenhouse", "Greenhouse")!;
    expect(job.closedEvidence).toMatch(/no longer available/i);
  });

  it("classifies the cover-letter field from the real form", () => {
    const mk = (over: Partial<DetectedField>): DetectedField => ({
      id: "f", selector: "#f", nameAttr: "", idAttr: "", inputType: "textarea", label: "Cover Letter", placeholder: "",
      surroundingText: "", required: false, mappedKey: "coverLetter", confidence: "high", reviewStatus: "Missing information",
      preparedValue: "", currentDomValue: "", ...over,
    });
    expect(detectCoverLetter([]).state).toBe("none");
    expect(detectCoverLetter([mk({})]).state).toBe("optional");
    expect(detectCoverLetter([mk({ required: true })]).state).toBe("required");
    expect(detectCoverLetter([mk({ inputType: "file", mappedKey: null })]).state).toBe("file-only");
  });

  it("detects Greenhouse by evidence and a sign-in wall", () => {
    const doc = page(`<form><h2>Sign in</h2><input type="email" name="email"/><input type="password"/></form>`);
    const ctx = detectPageContext(doc, "https://boards.greenhouse.io/acme/jobs/1", null, null);
    expect(ctx.platform).toBe("greenhouse");
    expect(ctx.needsSignIn).toBe(true);
  });

  it("surfaces page validation problems", () => {
    const doc = page(`<form id="application-form"><label>Email<input id="email" type="email" value="nope"/></label></form>`);
    const ctx = detectPageContext(doc, "http://localhost/x", null, null);
    expect(ctx.validationIssues.join(" ")).toMatch(/Email/);
  });
});

describe("field classification (never 'filled' without read-back)", () => {
  const base: DetectedField = {
    id: "a", selector: "#a", nameAttr: "", idAttr: "", inputType: "text", label: "Email", placeholder: "", surroundingText: "",
    required: true, mappedKey: "email", confidence: "high", reviewStatus: "Ready", preparedValue: "a@b.co", currentDomValue: "", evidence: "x",
  };
  it("fails when the page did not keep the value", () => {
    expect(classifyField(base, "").status).toBe("failed");
    expect(classifyField(base, "a@b.co").status).toBe("filled");
  });
  it("keeps sensitive, file and missing fields out of the filled set", () => {
    expect(classifyField({ ...base, confidence: "sensitive_manual" }).status).toBe("manual");
    expect(classifyField({ ...base, inputType: "file" }).status).toBe("file");
    expect(classifyField({ ...base, reviewStatus: "Missing information", preparedValue: "" }).status).toBe("missing");
    expect(autoFillableIds([base, { ...base, id: "b", confidence: "sensitive_manual" }, { ...base, id: "c", inputType: "file" }])).toEqual(["a"]);
  });
});

describe("extension state and protocol security", () => {
  beforeEach(async () => {
    await clearExtensionState();
  });

  it("serialises concurrent writes so no queue update is lost", async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        saveExtensionState((prev) => ({ ...prev, resumeVersions: [...prev.resumeVersions, { id: `v${i}`, name: `v${i}`, kind: "master", fitsOnePage: true, updatedAt: "" }] })),
      ),
    );
    expect((await loadExtensionState()).resumeVersions).toHaveLength(25);
  });

  it("does not trust a web page that claims the internal origin", async () => {
    const res = await handleExtensionMessage(msg("GET_APPLICATION_STATUS", {}, "extension://internal"), { url: "https://evil.example/x" });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("INVALID_ORIGIN");
  });

  it("limits profile-editing and run-state actions to extension pages", async () => {
    for (const action of ["UPDATE_SHARED_PROFILE", "SET_SELECTED_RESUME", "UPDATE_AUTOFILL_RUN"]) {
      const res = await handleExtensionMessage(msg(action, {}, SITE), { url: SITE });
      expect(`${action}:${res.ok}`).toBe(`${action}:false`);
      expect(res.error?.code).toBe("UNAUTHORIZED");
    }
    const ok = await handleExtensionMessage(msg("UPDATE_SHARED_PROFILE", { values: { phone: "1" } }), { isInternalExtensionPage: true });
    expect(ok.ok).toBe(true);
    expect((await loadExtensionState()).unconfirmedProfileFields).toContain("phone");
  });

  it("rejects analysis payloads that carry keys, and stores real ones", async () => {
    const bad = await handleExtensionMessage(msg("SYNC_ANALYSIS", { aiConnection: { apiKey: "sk-abcdefghijklmnopqrstuvwxyz" } }, SITE), { url: SITE });
    expect(bad.ok).toBe(false);
    const good = await handleExtensionMessage(
      msg("SYNC_ANALYSIS", { analyses: [{ applicationId: "a1", resumeVersionId: "r1", score: 72, requirements: [] }] }, SITE),
      { url: SITE },
    );
    expect(good.ok).toBe(true);
    expect((await loadExtensionState()).analyses.a1.r1.score).toBe(72);
  });

  it("matches the job only by explicit appId or the same URL", async () => {
    const item = { id: "a1", url: "https://boards.greenhouse.io/x/jobs/1", normalizedUrl: "https://boards.greenhouse.io/x/jobs/1" } as AutoApplyQueueItem;
    const state = { ...(await loadExtensionState()), queue: [item], activeApplicationId: "a1" };
    expect(matchApplication(state, "https://boards.greenhouse.io/x/jobs/1?utm=1")?.id).toBe("a1");
    expect(matchApplication(state, "https://other.example/job")).toBeNull();
  });
});

describe("local AI and analysis", () => {
  const snap = { provider: "lmstudio", providerLabel: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", model: "m", connected: true, isLocal: true, keyless: true, updatedAt: "" };
  it("only calls keyless loopback models from the extension", () => {
    expect(aiAvailability(snap).kind).toBe("ready");
    expect(aiAvailability({ ...snap, baseUrl: "https://api.openai.com/v1", isLocal: false, keyless: false }).kind).toBe("needs-careeros");
    expect(aiAvailability({ ...snap, keyless: false }).kind).toBe("needs-careeros");
    expect(aiAvailability({ ...snap, connected: false }).kind).toBe("none");
    expect(aiAvailability(null).kind).toBe("none");
  });

  it("builds snapshots from the real engine and returns null without a description", () => {
    const version = newVersion("Master", defaultMasterResume(), { kind: "master", settings: defaultSettings("classic") });
    const item = { id: "a1", title: "Linux Engineer", company: "Acme", jobDescription: "" } as AutoApplyQueueItem;
    expect(buildAnalysisSnapshot(item, version)).toBeNull();
    const snapshot = buildAnalysisSnapshot({ ...item, jobDescription: "Required: Linux, Bash, Python and Kubernetes experience." }, version)!;
    expect(snapshot.requirements.length).toBeGreaterThan(0);
    expect(snapshot.score).toBeGreaterThanOrEqual(0);
    expect(snapshot.quality.total).toBeGreaterThan(0);
    expect(JSON.stringify(snapshot)).not.toMatch(/apiKey/);
  });

  it("user marks change the displayed counts only", () => {
    const reqs = [
      { id: "1", group: "missing" },
      { id: "2", group: "missing" },
      { id: "3", group: "matched" },
    ] as never;
    const c = effectiveCounts(reqs, { "1": "na", "2": "confirmed" });
    expect(c).toMatchObject({ missing: 0, notApplicable: 1, userConfirmed: 1, matched: 1 });
  });
});
