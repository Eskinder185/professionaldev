import { AIError, type Fetch, type ModelInfo } from "./client";
import { PROVIDERS, createAdapterForProvider, type ProviderId } from "./providers";
import { AI_TASKS, evaluateModelSuitabilityForTask, type AITaskId } from "./taskModels";

/**
 * Local AI discovery.
 *
 * Checks exactly the standard loopback addresses of the two supported local apps, and nothing else:
 * no port scanning, no other hosts, no network ranges. It never runs before the person agrees
 * (see the consent helpers below), and it reuses the same adapters the rest of CareerOS uses.
 *
 * A browser cannot tell "the app is not running" from "the app is running but refused this site"
 * (both look like a failed request), so the result says exactly that instead of guessing.
 */

export interface LocalCandidate {
  provider: Extract<ProviderId, "ollama" | "lmstudio">;
  /** Plain name shown to the person. */
  label: string;
  /** The only address that will be contacted for this app. */
  baseUrl: string;
}

export const LOCAL_CANDIDATES: readonly LocalCandidate[] = [
  { provider: "ollama", label: "Ollama", baseUrl: PROVIDERS.ollama.defaultBaseUrl },
  { provider: "lmstudio", label: "LM Studio", baseUrl: PROVIDERS.lmstudio.defaultBaseUrl },
];

export type DiscoveryResult =
  | { status: "found"; candidate: LocalCandidate; models: ModelInfo[]; version?: string; latencyMs: number }
  | { status: "empty"; candidate: LocalCandidate; version?: string }
  /** No answer. The app may be closed, or the browser may have blocked this site. */
  | { status: "unreachable"; candidate: LocalCandidate }
  /** Something answered but not usefully (needs a key, unexpected reply). */
  | { status: "problem"; candidate: LocalCandidate; message: string };

export type DiscoveryPhase = "checking" | "listing" | "done";

export interface DiscoveryOptions {
  fetchImpl?: Fetch;
  /** Stops the whole check. */
  signal?: AbortSignal;
  /** Per-app time limit. Local apps answer in milliseconds, so this stays short. */
  timeoutMs?: number;
  onStep?: (candidate: LocalCandidate, phase: DiscoveryPhase) => void;
}

const UNREACHABLE_KINDS = new Set(["network", "timeout", "cancelled", "redirect"]);

export async function discoverLocalAI(options: DiscoveryOptions = {}): Promise<DiscoveryResult[]> {
  const { fetchImpl, signal, timeoutMs = 3000, onStep } = options;
  const results: DiscoveryResult[] = [];

  for (const candidate of LOCAL_CANDIDATES) {
    if (signal?.aborted) break;
    onStep?.(candidate, "checking");
    const adapter = createAdapterForProvider(candidate.provider, fetchImpl);
    const target = { baseUrl: candidate.baseUrl, apiKey: "" };

    // One time limit per app, combined with the caller's cancel signal.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener("abort", onOuterAbort, { once: true });

    try {
      const started = performance.now();
      const probe = await adapter.probe(target, controller.signal);
      onStep?.(candidate, "listing");
      const models = (await adapter.listModels(target, controller.signal)) ?? [];
      const usable = models.filter((model) => model.id && !/embed/i.test(model.id));
      results.push(
        usable.length
          ? { status: "found", candidate, models: usable, version: probe.version, latencyMs: Math.round(performance.now() - started) }
          : { status: "empty", candidate, version: probe.version },
      );
    } catch (error) {
      if (signal?.aborted) break;
      if (error instanceof AIError && !UNREACHABLE_KINDS.has(error.kind)) {
        results.push({ status: "problem", candidate, message: error.message });
      } else {
        results.push({ status: "unreachable", candidate });
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
    }
  }
  onStep?.(LOCAL_CANDIDATES[LOCAL_CANDIDATES.length - 1], "done");
  return results;
}

/** What the person agreed to, remembered on this device. Detection never runs without "allowed". */
export const DISCOVERY_CONSENT_KEY = "pd:careeros:ai-discovery-consent";
export type DiscoveryConsent = "allowed" | "declined" | null;

export function readDiscoveryConsent(): DiscoveryConsent {
  try {
    const value = localStorage.getItem(DISCOVERY_CONSENT_KEY);
    return value === "allowed" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function writeDiscoveryConsent(value: Exclude<DiscoveryConsent, null>): void {
  try {
    localStorage.setItem(DISCOVERY_CONSENT_KEY, value);
  } catch {
    // The choice still applies for this visit.
  }
}

export function clearDiscoveryConsent(): void {
  try {
    localStorage.removeItem(DISCOVERY_CONSENT_KEY);
  } catch {
    // Nothing stored.
  }
}

/** Human-readable size from bytes, or undefined when the app did not report one. */
export function formatSize(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(gb >= 10 ? 0 : 1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

const TASK_NOUNS: Partial<Record<AITaskId, string>> = {
  job_analysis: "reading job postings",
  resume_matching: "comparing your résumé",
  resume_tailoring: "tailoring your résumé",
  cover_letter: "cover letters",
  question_drafting: "application answers",
  interview_analysis: "interview feedback",
  agent_planning: "Autopilot planning",
};

/**
 * Which CareerOS jobs this model is suited to, using the same rules the rest of the app applies
 * (size, structured-output ability). Honest by construction: small or unknown models are flagged.
 */
export function suitabilityFor(candidate: LocalCandidate, model: ModelInfo): { good: string[]; limited: string[] } {
  const good: string[] = [];
  const limited: string[] = [];
  for (const task of AI_TASKS) {
    const result = evaluateModelSuitabilityForTask(task.id, model.id, {}, { provider: candidate.provider, baseUrl: candidate.baseUrl, modelDetails: model });
    (result.suitable ? good : limited).push(TASK_NOUNS[task.id] ?? task.label.toLowerCase());
  }
  return { good, limited };
}
