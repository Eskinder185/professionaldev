import { adapterFor, PROVIDERS, type ProviderId } from "../../../../src/features/ai/providers";
import { validateEndpoint } from "../../../../src/features/ai/endpoint";
import { detectModelCapabilities, type AITaskId } from "../../../../src/features/ai/taskModels";
import type { AIConnectionSnapshot } from "../../../../packages/careeros-shared/types";

export const LOCAL_PROVIDERS: ProviderId[] = ["ollama", "lmstudio", "custom"];
export const CLOUD_PROVIDERS: ProviderId[] = ["openai", "gemini", "anthropic", "custom_cloud"];

/** Extension inference is limited to keyless loopback servers. A loopback proxy may still forward data. */
export function validateExtensionDestination(provider: ProviderId, baseUrl: string): string | null {
  const endpoint = validateEndpoint(baseUrl);
  if (!endpoint.ok) return endpoint.error;
  if (!LOCAL_PROVIDERS.includes(provider)) return "Cloud setup required: this extension has no authenticated credential companion. No cloud request will be sent.";
  if (!endpoint.isLoopback) return "The extension only connects directly to a server on this device (localhost or 127.0.0.1).";
  return null;
}

export function disconnectedSnapshot(provider: ProviderId, baseUrl: string, model = "", previous?: AIConnectionSnapshot | null): AIConnectionSnapshot {
  const endpoint = validateEndpoint(baseUrl);
  return {
    provider,
    providerLabel: PROVIDERS[provider].label,
    baseUrl,
    model,
    connected: false,
    isLocal: endpoint.ok && endpoint.isLoopback,
    keyless: LOCAL_PROVIDERS.includes(provider),
    localOnlyMode: previous?.localOnlyMode ?? true,
    taskModels: previous?.taskModels ?? {},
    credentialMode: LOCAL_PROVIDERS.includes(provider) ? "local_keyless" : "setup_required",
    credentialBadge: LOCAL_PROVIDERS.includes(provider) ? "Keyless loopback" : "Setup required",
    capabilities: [],
    discoveredModels: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function discoverExtensionModels(provider: ProviderId, baseUrl: string, signal?: AbortSignal): Promise<Array<{ id: string; parameterSize?: string }>> {
  const blocked = validateExtensionDestination(provider, baseUrl);
  if (blocked) throw new Error(blocked);
  const models = await adapterFor(provider).listModels({ baseUrl, apiKey: "" }, signal);
  if (!models) throw new Error("This server does not provide model discovery. Enter the exact model name.");
  return models.map((item) => ({ id: item.id, parameterSize: item.parameterSize }));
}

export async function testExtensionModel(provider: ProviderId, baseUrl: string, model: string, previous?: AIConnectionSnapshot | null, signal?: AbortSignal): Promise<AIConnectionSnapshot> {
  const blocked = validateExtensionDestination(provider, baseUrl);
  if (blocked) throw new Error(blocked);
  if (!model.trim()) throw new Error("Choose a model before testing.");
  const adapter = adapterFor(provider);
  await adapter.probe({ baseUrl, apiKey: "" }, signal);
  const models = await adapter.listModels({ baseUrl, apiKey: "" }, signal);
  if (models && !models.some((item) => item.id === model.trim())) throw new Error(`The server did not list “${model.trim()}”. Choose an available model.`);
  const details = await adapter.describeModel({ baseUrl, apiKey: "" }, model.trim(), signal).catch(() => null);
  // A model list confirms availability; when no list is available, a generation test is required.
  if (!models) {
    const reply = await adapter.chat({ baseUrl, apiKey: "", model: model.trim(), structured: PROVIDERS[provider].structured }, [{ role: "user", content: "Reply with the word ready." }], { signal, timeoutMs: 30_000 });
    if (!reply.text.trim()) throw new Error("The model returned an empty test response.");
  }
  const capability = detectModelCapabilities(model.trim(), details ?? models?.find((item) => item.id === model.trim()), provider);
  return {
    ...disconnectedSnapshot(provider, baseUrl, model.trim(), previous),
    connected: true,
    capabilities: capability.summaryBadges.map((badge) => `${badge} (estimated)`),
    discoveredModels: models?.map((item) => ({ id: item.id, parameterSize: item.parameterSize })) ?? [],
  };
}

export function effectiveExtensionModel(snapshot: AIConnectionSnapshot, task: AITaskId): string {
  return snapshot.taskModels?.[task]?.trim() || snapshot.model;
}
