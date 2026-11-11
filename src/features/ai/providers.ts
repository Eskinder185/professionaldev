/**
 * Provider presets for Local and Cloud AI.
 *
 * Local providers:
 * - Ollama (native /api/* with /v1 fallback)
 * - LM Studio (OpenAI-compatible /v1/*)
 * - Custom local OpenAI-compatible server
 *
 * Cloud providers:
 * - OpenAI (/v1/models, /v1/chat/completions)
 * - Google Gemini (/v1beta/models, :generateContent, x-goog-api-key header)
 * - Anthropic Claude (/v1/models, /v1/messages, x-api-key + anthropic-version headers)
 * - Custom cloud OpenAI-compatible server
 */

import { createAnthropicAdapter } from "./anthropic";
import { createOpenAICompatibleAdapter, type AIAdapter, type Fetch, type StructuredMode } from "./client";
import { createGeminiAdapter } from "./gemini";
import { createOllamaAdapter } from "./ollama";

export type { StructuredMode };
export type ProviderId =
  | "ollama"
  | "lmstudio"
  | "custom"
  | "openai"
  | "gemini"
  | "anthropic"
  | "custom_cloud";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  /** Shown as the model field placeholder. Never used as a default value. */
  modelPlaceholder: string;
  keyRequired: boolean;
  keyHint: string;
  /** Runs on this device by default. */
  local: boolean;
  structured: StructuredMode;
  api: "ollama" | "openai" | "gemini" | "anthropic";
  setupHint: string;
  privacySummary: string;
  costGuidance: string;
}

export const PROVIDERS: Record<ProviderId, ProviderPreset> = {
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    modelPlaceholder: "Exact name from `ollama list` (e.g. qwen2.5:7b)",
    keyRequired: false,
    keyHint: "Not needed for a local Ollama server.",
    local: true,
    structured: "prompt",
    api: "ollama",
    setupHint: "Start Ollama, then use Load models or type a name from `ollama list`.",
    privacySummary: "Runs on your local machine (127.0.0.1). Career data stays on your device unless you configure Ollama to proxy to a remote host.",
    costGuidance: "Free — runs on your local CPU/GPU hardware with zero per-token API fees.",
  },
  lmstudio: {
    id: "lmstudio",
    label: "LM Studio (local)",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    modelPlaceholder: "Model identifier shown in LM Studio",
    keyRequired: false,
    keyHint: "Only needed if you turned on “Require Authentication” in LM Studio.",
    local: true,
    structured: "json_schema",
    api: "openai",
    setupHint: "In LM Studio’s Developer tab, start the server and turn on Enable CORS.",
    privacySummary: "Runs locally inside LM Studio on 127.0.0.1. No external cloud transmission.",
    costGuidance: "Free — runs locally on your machine.",
  },
  custom: {
    id: "custom",
    label: "Custom Local (OpenAI-compatible)",
    defaultBaseUrl: "http://127.0.0.1:8080/v1",
    modelPlaceholder: "Model ID your local server expects",
    keyRequired: false,
    keyHint: "Leave empty if your local server doesn’t need a key.",
    local: true,
    structured: "prompt",
    api: "openai",
    setupHint: "For llama.cpp, vLLM, LocalAI, or a Secure Local Companion proxy on 127.0.0.1.",
    privacySummary: "Connects to your local OpenAI-compatible server or local credential companion.",
    costGuidance: "Free when running local weights; billed by upstream if used as a cloud companion.",
  },
  openai: {
    id: "openai",
    label: "OpenAI (cloud)",
    defaultBaseUrl: "https://api.openai.com/v1",
    modelPlaceholder: "e.g. gpt-4o-mini or gpt-4o",
    keyRequired: true,
    keyHint: "Cloud credentials are not accepted until secure transport is available.",
    local: false,
    structured: "json_schema",
    api: "openai",
    setupHint: "Setup required: authenticated credential transport is not yet available.",
    privacySummary: "Cloud provider (HTTPS). Approved prompt context is transmitted to api.openai.com when you trigger an AI action.",
    costGuidance: "Paid per input/output token on your OpenAI API billing account.",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini (cloud)",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelPlaceholder: "e.g. gemini-2.5-flash or gemini-2.5-pro",
    keyRequired: true,
    keyHint: "Cloud credentials are not accepted until secure transport is available.",
    local: false,
    structured: "json_schema",
    api: "gemini",
    setupHint: "Setup required: authenticated credential transport is not yet available.",
    privacySummary: "Cloud provider (HTTPS). Approved prompt context is sent to generativelanguage.googleapis.com.",
    costGuidance: "Billed per token or covered by your Google AI Studio tier.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude (cloud)",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    modelPlaceholder: "e.g. claude-sonnet-4-20250514 or claude-3-5-haiku-latest",
    keyRequired: true,
    keyHint: "Cloud credentials are not accepted until secure transport is available.",
    local: false,
    structured: "prompt",
    api: "anthropic",
    setupHint: "Setup required: authenticated credential transport is not yet available.",
    privacySummary: "Cloud provider (HTTPS). Approved prompt context is sent to api.anthropic.com.",
    costGuidance: "Paid per input/output token on your Anthropic Console account.",
  },
  custom_cloud: {
    id: "custom_cloud",
    label: "Custom Cloud (OpenAI-compatible)",
    defaultBaseUrl: "https://",
    modelPlaceholder: "Model ID your cloud endpoint expects",
    keyRequired: true,
    keyHint: "Cloud credentials are not accepted until secure transport is available.",
    local: false,
    structured: "prompt",
    api: "openai",
    setupHint: "Setup required: authenticated credential transport is not yet available.",
    privacySummary: "Cloud provider (HTTPS). Data is sent to your configured HTTPS endpoint only after explicit consent.",
    costGuidance: "Depends on your cloud gateway or hosted inference provider.",
  },
};

export const PROVIDER_ORDER: ProviderId[] = [
  "ollama",
  "lmstudio",
  "custom",
  "openai",
  "gemini",
  "anthropic",
  "custom_cloud",
];

const defaultAdapters: Record<ProviderPreset["api"], AIAdapter> = {
  ollama: createOllamaAdapter(),
  openai: createOpenAICompatibleAdapter(),
  gemini: createGeminiAdapter(),
  anthropic: createAnthropicAdapter(),
};

export function createAdapterForProvider(provider: ProviderId, fetchImpl?: Fetch): AIAdapter {
  const api = PROVIDERS[provider].api;
  if (!fetchImpl) return defaultAdapters[api];
  switch (api) {
    case "ollama":
      return createOllamaAdapter(fetchImpl);
    case "gemini":
      return createGeminiAdapter(fetchImpl);
    case "anthropic":
      return createAnthropicAdapter(fetchImpl);
    case "openai":
    default:
      return createOpenAICompatibleAdapter(fetchImpl);
  }
}

export const adapterFor = (provider: ProviderId): AIAdapter => defaultAdapters[PROVIDERS[provider].api];
