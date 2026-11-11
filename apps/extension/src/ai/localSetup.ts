import { AIError, type Fetch, type ModelInfo } from "../../../../src/features/ai/client";
import { createAdapterForProvider, PROVIDERS, type ProviderId } from "../../../../src/features/ai/providers";
import { evaluateModelSuitabilityForTask, type AITaskId } from "../../../../src/features/ai/taskModels";
import { LOCAL_CANDIDATES, type DiscoveryResult, type LocalCandidate } from "../../../../src/features/ai/discovery";
import type { AIConnectionSnapshot } from "../../../../packages/careeros-shared/types";
import { disconnectedSnapshot, testExtensionModel } from "./localConnection";

/**
 * Logic behind the one-click AI setup. Nothing here touches the screen, so each rule can be tested.
 *
 *  - Discovery contacts exactly the two standard loopback addresses (Ollama and LM Studio) and
 *    only after the person has agreed. Agreement is stored on this device and can be revoked.
 *  - "Ready" needs a real reply from the model. A saved setting alone is never enough.
 *  - Model ranking uses what the app itself reports (size, structured-output ability) and
 *    CareerOS's own task-suitability rules. It makes no speed or quality claims beyond that.
 */

/* ---------------- consent ---------------- */

export const DISCOVERY_CONSENT_KEY = "careeros:ai-discovery-consent";
export type DiscoveryConsent = "allowed" | "declined" | null;

interface KeyValue {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove?(key: string): Promise<void>;
}

const browserStorage = (): KeyValue | null => (globalThis as unknown as { chrome?: { storage?: { local?: KeyValue } } }).chrome?.storage?.local ?? null;

export async function readDiscoveryConsent(storage: KeyValue | null = browserStorage()): Promise<DiscoveryConsent> {
  try {
    const value = (await storage?.get(DISCOVERY_CONSENT_KEY))?.[DISCOVERY_CONSENT_KEY];
    return value === "allowed" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export async function writeDiscoveryConsent(value: Exclude<DiscoveryConsent, null>, storage: KeyValue | null = browserStorage()): Promise<void> {
  try {
    await storage?.set({ [DISCOVERY_CONSENT_KEY]: value });
  } catch {
    // The choice still applies until the panel closes.
  }
}

export async function revokeDiscoveryConsent(storage: KeyValue | null = browserStorage()): Promise<void> {
  try {
    await (storage?.remove ? storage.remove(DISCOVERY_CONSENT_KEY) : storage?.set({ [DISCOVERY_CONSENT_KEY]: null }));
  } catch {
    // Nothing stored.
  }
}

/* ---------------- ranking ---------------- */

/** CareerOS's everyday jobs. A model is recommended only if it suits all three. */
export const CORE_TASKS: AITaskId[] = ["job_analysis", "resume_matching", "question_drafting"];

export interface RankedModel {
  model: ModelInfo;
  /** Suited to everyday CareerOS tasks according to CareerOS's own rules. */
  suitable: boolean;
  /** Plain note when it isn't, taken from the same rules. */
  caution: string;
  /** Size the app reported, in billions of parameters, when known. */
  billions: number | null;
}

export interface RankedModels {
  recommended: RankedModel | null;
  /** The smallest suitable model, when it differs from the recommended one and sizes are known. */
  fastest: RankedModel | null;
  others: RankedModel[];
}

export function parseBillions(model: ModelInfo): number | null {
  const fromParam = /([\d.]+)\s*b\b/i.exec(model.parameterSize ?? "");
  if (fromParam) return Number(fromParam[1]);
  const fromName = /(?:^|[^\d.])(\d+(?:\.\d+)?)\s*b(?:[^a-z]|$)/i.exec(model.id);
  return fromName ? Number(fromName[1]) : null;
}

export function assessModel(candidate: LocalCandidate, model: ModelInfo): RankedModel {
  let caution = "";
  let suitable = true;
  for (const task of CORE_TASKS) {
    const result = evaluateModelSuitabilityForTask(task, model.id, {}, { provider: candidate.provider, baseUrl: candidate.baseUrl, modelDetails: model });
    if (!result.suitable) {
      suitable = false;
      caution ||= result.capability.isEmbeddingOnly ? "This model isn’t meant for chat." : "Probably too small for reliable résumé work.";
    }
  }
  return { model, suitable, caution, billions: parseBillions(model) };
}

export function rankModels(candidate: LocalCandidate, models: ModelInfo[]): RankedModels {
  const assessed = models.map((model) => assessModel(candidate, model));
  const suitable = assessed.filter((m) => m.suitable);
  // Most capable suitable model: the largest reported size; unknown sizes sort last, then by name for a stable pick.
  const byCapability = [...suitable].sort((a, b) => (b.billions ?? -1) - (a.billions ?? -1) || a.model.id.localeCompare(b.model.id));
  const recommended = byCapability[0] ?? null;
  const sized = suitable.filter((m) => m.billions !== null).sort((a, b) => (a.billions as number) - (b.billions as number));
  const smallest = sized[0] ?? null;
  const fastest = recommended && smallest && smallest.model.id !== recommended.model.id && recommended.billions !== null && (smallest.billions as number) < recommended.billions ? smallest : null;
  const used = new Set([recommended?.model.id, fastest?.model.id]);
  return { recommended, fastest, others: assessed.filter((m) => !used.has(m.model.id)) };
}

/* ---------------- results ---------------- */

export interface FoundService {
  candidate: LocalCandidate;
  models: ModelInfo[];
  ranked: RankedModels;
}

export type SetupOutcome =
  | { kind: "found"; services: FoundService[] }
  /** Nothing answered. */
  | { kind: "none"; empty: LocalCandidate[]; problems: Array<{ candidate: LocalCandidate; message: string }> };

export function summarizeDiscovery(results: DiscoveryResult[]): SetupOutcome {
  const services: FoundService[] = [];
  const empty: LocalCandidate[] = [];
  const problems: Array<{ candidate: LocalCandidate; message: string }> = [];
  for (const result of results) {
    if (result.status === "found") services.push({ candidate: result.candidate, models: result.models, ranked: rankModels(result.candidate, result.models) });
    else if (result.status === "empty") empty.push(result.candidate);
    else if (result.status === "problem") problems.push({ candidate: result.candidate, message: plainError(new AIError("bad_request", result.message)) });
  }
  return services.length ? { kind: "found", services } : { kind: "none", empty, problems };
}

/* ---------------- friendly errors ---------------- */

/** Plain-language text for ordinary people. Technical detail stays in Advanced settings. */
export function plainError(error: unknown): string {
  if (error instanceof AIError) {
    switch (error.kind) {
      case "network":
      case "timeout":
        return "CareerOS couldn’t reach your AI. Make sure the app is open and running, then try again.";
      case "model_not_found":
        return "That model isn’t available anymore. Pick another one.";
      case "auth":
      case "forbidden":
        return "Your AI app asked for a sign-in or refused the request, so CareerOS can’t use it directly.";
      case "cancelled":
        return "Stopped.";
      case "malformed":
        return "Your AI answered, but not in a way CareerOS could use. Try a different model.";
      case "server":
        return "Your AI app ran into a problem while answering. Try again in a moment, or pick a smaller model.";
      default:
        return "Something went wrong talking to your AI. Try again, or open Advanced settings for details.";
    }
  }
  const e = error as { name?: string; message?: string } | null;
  if (e?.name === "AbortError" || /abort|cancel/i.test(e?.message ?? "")) return "Stopped.";
  return "Something went wrong. Try again, or open Advanced settings for details.";
}

/* ---------------- verified connection ---------------- */

export interface VerifyDeps {
  fetchImpl?: Fetch;
}

/**
 * Connects only after the model has really answered. Checks the server, confirms the model is
 * listed, and asks it for one short reply; an empty reply is a failure.
 */
export async function connectAndTest(provider: ProviderId, baseUrl: string, model: string, previous: AIConnectionSnapshot | null, signal?: AbortSignal, deps: VerifyDeps = {}): Promise<AIConnectionSnapshot> {
  const snapshot = await testExtensionModel(provider, baseUrl, model, previous, signal);
  const adapter = createAdapterForProvider(provider, deps.fetchImpl);
  const reply = await adapter.chat(
    { baseUrl, apiKey: "", model: model.trim(), structured: PROVIDERS[provider].structured },
    [{ role: "user", content: "Reply with the single word: ready" }],
    { signal, timeoutMs: 90_000 },
  );
  if (!reply.text.trim()) throw new AIError("malformed", "The model returned an empty reply.");
  return { ...snapshot, connected: true, updatedAt: new Date().toISOString() };
}

/**
 * Is the saved model still there? A quick look at the server, no generation. Used when the panel
 * opens so a saved "connected" setting is never shown as ready unless the model is actually available.
 */
export type Availability = { ok: true } | { ok: false; reason: "service" | "model"; message: string };

export async function checkSavedConnection(snapshot: AIConnectionSnapshot, signal?: AbortSignal, deps: VerifyDeps = {}): Promise<Availability> {
  const provider = snapshot.provider as ProviderId;
  const adapter = createAdapterForProvider(provider, deps.fetchImpl);
  try {
    await adapter.probe({ baseUrl: snapshot.baseUrl, apiKey: "" }, signal);
  } catch (error) {
    return { ok: false, reason: "service", message: plainError(error) };
  }
  try {
    const models = await adapter.listModels({ baseUrl: snapshot.baseUrl, apiKey: "" }, signal);
    if (models && !models.some((m) => m.id === snapshot.model)) return { ok: false, reason: "model", message: `“${snapshot.model}” isn’t installed in ${PROVIDERS[provider].label.replace(/\s*\(.*\)$/, "")} anymore.` };
  } catch (error) {
    return { ok: false, reason: "service", message: plainError(error) };
  }
  return { ok: true };
}

export const disconnected = (snapshot: AIConnectionSnapshot): AIConnectionSnapshot => disconnectedSnapshot(snapshot.provider as ProviderId, snapshot.baseUrl, snapshot.model, snapshot);

export { LOCAL_CANDIDATES };

/* ---------------- setup guide (no software is installed or run from here) ---------------- */

export type Os = "windows" | "mac";
export type SetupApp = "ollama" | "lmstudio";

export interface GuideStep {
  title: string;
  detail: string;
  link?: { label: string; href: string };
  /** A command the person can copy and run themselves. */
  command?: string;
}

/** Links and commands come from the verified catalog used by the website's install helper. */
export const OFFICIAL_LINKS = {
  ollama: "https://ollama.com/download",
  lmstudio: "https://lmstudio.ai/",
} as const;

export function guideSteps(app: SetupApp, os: Os, modelTag: { ollama: string; lmStudio: string }): GuideStep[] {
  const osName = os === "windows" ? "Windows" : "macOS";
  if (app === "ollama") {
    return [
      { title: `Download Ollama for ${osName}`, detail: "Use the official page. CareerOS never installs anything for you.", link: { label: "Open ollama.com/download", href: OFFICIAL_LINKS.ollama } },
      { title: "Install it and open it once", detail: os === "windows" ? "Ollama runs quietly in the system tray after it starts." : "Ollama runs from the menu bar after it starts." },
      { title: "Download a model", detail: "Open a terminal (Command Prompt or PowerShell on Windows, Terminal on Mac), paste this, and press Enter. It’s a one-time download.", command: `ollama pull ${modelTag.ollama}` },
      { title: "Come back and check again", detail: "CareerOS will find it automatically." },
    ];
  }
  return [
    { title: `Download LM Studio for ${osName}`, detail: "Use the official page. CareerOS never installs anything for you.", link: { label: "Open lmstudio.ai", href: OFFICIAL_LINKS.lmstudio } },
    { title: "Download a model inside LM Studio", detail: `Open the Discover tab and download a model. A small, general-purpose one such as “${modelTag.lmStudio}” is a good start.` },
    { title: "Start the local server", detail: "In LM Studio, open the Developer tab and turn on “Start server”. Keep LM Studio open." },
    { title: "Come back and check again", detail: "CareerOS will find it automatically." },
  ];
}
