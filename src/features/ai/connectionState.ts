/**
 * AI connection state. Pure reducer so the privacy rules are unit-testable:
 * - Changing the provider or base URL clears the key, status, model list, diagnostics and consent.
 * - Changing the model clears the verified status and model details (not the key).
 * - Nothing may be sent until the user has consented to the current destination.
 * - "connected" is only ever set from a real, successful check in this session.
 * The API key and the permission are never persisted. If the user opts in (`remember`),
 * provider, URL and model are restored from configStore, always as "not checked yet".
 */
import type { ChatMetrics, ModelInfo } from "./client";
import { validateEndpoint } from "./endpoint";
import { PROVIDERS, type ProviderId } from "./providers";
import {
  evaluateCloudCredentialStatus,
  evaluateModelSuitabilityForTask,
  type AITaskId,
  type TaskModelMap,
} from "./taskModels";

export type ConnectionStatus =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "connected"; checkedAt: number; detail: string }
  | { kind: "error"; message: string };

export type DiagnosticId = "reach" | "model" | "details" | "inference";

export interface Diagnostic {
  id: DiagnosticId;
  label: string;
  state: "running" | "ok" | "fail" | "skipped";
  detail: string;
  ms?: number;
}

export interface InferenceResult {
  text: string;
  metrics: ChatMetrics;
  at: number;
}

export interface ConnectionState {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  /** The exact base URL the user agreed to send requests to, or null. */
  consentFor: string | null;
  status: ConnectionStatus;
  models: ModelInfo[] | null;
  /** Details of `model` from the server (capabilities, context length), when known. */
  modelDetails: ModelInfo | null;
  serverVersion: string | null;
  diagnostics: Diagnostic[];
  inference: InferenceResult | null;
  /** Settings were restored from a previous visit and haven't been checked this session. */
  restored: boolean;
  /** The user opted in to remembering provider, URL and model on this device. */
  remember: boolean;
  /** When enabled, blocks all requests to non-loopback cloud endpoints. */
  localOnlyMode: boolean;
  /** Optional per-task model overrides (defaults to `model` when unset). */
  taskModels: TaskModelMap;
}

export type ConnectionAction =
  | { type: "provider"; provider: ProviderId }
  | { type: "baseUrl"; baseUrl: string }
  | { type: "destination"; provider: ProviderId; baseUrl: string }
  | { type: "model"; model: string }
  | { type: "apiKey"; apiKey: string }
  | { type: "consent"; value: boolean }
  | { type: "status"; status: ConnectionStatus }
  | { type: "models"; models: ModelInfo[] | null }
  | { type: "modelDetails"; details: ModelInfo | null }
  | { type: "serverVersion"; version: string | null }
  | { type: "diagnostic"; diagnostic: Diagnostic }
  | { type: "resetDiagnostics" }
  | { type: "inference"; result: InferenceResult | null }
  | { type: "remember"; value: boolean }
  | { type: "localOnlyMode"; value: boolean }
  | { type: "taskModel"; task: AITaskId; model: string }
  | {
      type: "hydrateSync";
      config: {
        provider?: ProviderId;
        baseUrl?: string;
        model?: string;
        localOnlyMode?: boolean;
        taskModels?: TaskModelMap;
      };
    }
  | { type: "disconnect" }
  | { type: "clear" };

export function initialConnection(provider: ProviderId = "ollama"): ConnectionState {
  return {
    provider,
    baseUrl: PROVIDERS[provider].defaultBaseUrl,
    model: "",
    apiKey: "",
    consentFor: null,
    status: { kind: "idle" },
    models: null,
    modelDetails: null,
    serverVersion: null,
    diagnostics: [],
    inference: null,
    restored: false,
    remember: false,
    localOnlyMode: false,
    taskModels: {},
  };
}

const resetDestination = (s: ConnectionState): ConnectionState => ({
  ...s,
  apiKey: "",
  consentFor: null,
  status: { kind: "idle" },
  models: null,
  modelDetails: null,
  serverVersion: null,
  diagnostics: [],
  inference: null,
  restored: false,
});

const unverified = (s: ConnectionState): ConnectionStatus => (s.status.kind === "testing" ? s.status : { kind: "idle" });

export function connectionReducer(state: ConnectionState, action: ConnectionAction): ConnectionState {
  switch (action.type) {
    case "provider":
      if (action.provider === state.provider) return state;
      return {
        ...resetDestination(state),
        provider: action.provider,
        baseUrl: PROVIDERS[action.provider].defaultBaseUrl,
        model: "",
        taskModels: {},
      };
    case "baseUrl":
      if (action.baseUrl === state.baseUrl) return state;
      return { ...resetDestination(state), baseUrl: action.baseUrl };
    case "destination":
      if (action.provider === state.provider && action.baseUrl === state.baseUrl) return state;
      return { ...resetDestination(state), provider: action.provider, baseUrl: action.baseUrl, model: "", taskModels: {} };
    case "model":
      if (action.model === state.model) return state;
      return { ...state, model: action.model, status: unverified(state), modelDetails: null, diagnostics: [], inference: null };
    case "apiKey":
      if (action.apiKey === state.apiKey) return state;
      return { ...state, apiKey: action.apiKey, status: unverified(state), diagnostics: [], inference: null };
    case "consent": {
      const v = validateEndpoint(state.baseUrl);
      const consentFor = action.value && v.ok ? v.baseUrl : null;
      return consentFor ? { ...state, consentFor } : { ...state, consentFor: null, status: unverified(state) };
    }
    case "status":
      return { ...state, status: action.status, restored: action.status.kind === "connected" ? false : state.restored };
    case "models":
      return { ...state, models: action.models };
    case "modelDetails":
      return { ...state, modelDetails: action.details };
    case "serverVersion":
      return { ...state, serverVersion: action.version };
    case "diagnostic": {
      const rest = state.diagnostics.filter((d) => d.id !== action.diagnostic.id);
      const order: DiagnosticId[] = ["reach", "model", "details", "inference"];
      return { ...state, diagnostics: [...rest, action.diagnostic].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) };
    }
    case "resetDiagnostics":
      return { ...state, diagnostics: [], inference: null };
    case "inference":
      return { ...state, inference: action.result };
    case "remember":
      return { ...state, remember: action.value };
    case "localOnlyMode": {
      const next = action.value;
      const v = validateEndpoint(state.baseUrl);
      const isCloudEndpoint = v.ok ? !v.isLoopback : !PROVIDERS[state.provider].local;
      if (next && isCloudEndpoint) {
        return {
          ...state,
          localOnlyMode: true,
          status: { kind: "idle" },
          consentFor: null,
        };
      }
      return { ...state, localOnlyMode: next };
    }
    case "taskModel": {
      const nextMap: TaskModelMap = { ...state.taskModels };
      if (action.model.trim()) {
        nextMap[action.task] = action.model.trim();
      } else {
        delete nextMap[action.task];
      }
      return { ...state, taskModels: nextMap };
    }
    case "hydrateSync": {
      const nextProvider =
        action.config.provider && action.config.provider in PROVIDERS ? action.config.provider : state.provider;
      const nextBaseUrl =
        typeof action.config.baseUrl === "string" && validateEndpoint(action.config.baseUrl).ok
          ? validateEndpoint(action.config.baseUrl).ok
            ? (validateEndpoint(action.config.baseUrl) as { ok: true; baseUrl: string }).baseUrl
            : state.baseUrl
          : nextProvider !== state.provider
            ? PROVIDERS[nextProvider].defaultBaseUrl
            : state.baseUrl;
      const destChanged = nextProvider !== state.provider || nextBaseUrl !== state.baseUrl;
      const base = destChanged ? resetDestination(state) : state;
      return {
        ...base,
        provider: nextProvider,
        baseUrl: nextBaseUrl,
        model: typeof action.config.model === "string" ? action.config.model : base.model,
        localOnlyMode:
          typeof action.config.localOnlyMode === "boolean" ? action.config.localOnlyMode : base.localOnlyMode,
        taskModels: action.config.taskModels ?? base.taskModels,
      };
    }
    case "disconnect":
      return { ...state, apiKey: "", status: { kind: "idle" }, diagnostics: [], inference: null, consentFor: null };
    case "clear":
      return initialConnection(state.provider);
  }
}

export function effectiveModelForTask(state: ConnectionState, task?: AITaskId): string {
  if (task && state.taskModels[task]?.trim()) {
    return state.taskModels[task]!.trim();
  }
  return state.model.trim();
}

/** Why a request may not be sent yet, or null when it may. */
export function sendBlocker(state: ConnectionState, needModel = true, task?: AITaskId): string | null {
  const v = validateEndpoint(state.baseUrl);
  if (!v.ok) return v.error;
  if (state.localOnlyMode && !v.isLoopback) {
    return "Blocked by Local Only Mode: career data is restricted to local loopback servers (127.0.0.1 / localhost).";
  }
  if (state.consentFor !== v.baseUrl) return `Confirm that CareerOS may send requests to ${v.host}.`;
  const credStatus = evaluateCloudCredentialStatus(
    state.provider,
    state.baseUrl,
    Boolean(state.apiKey.trim()),
    state.localOnlyMode,
  );
  if (!credStatus.ready) {
    return credStatus.explanation;
  }
  const activeModel = effectiveModelForTask(state, task);
  if (needModel && !activeModel) return "Choose a model.";
  if (needModel && task) {
    const suit = evaluateModelSuitabilityForTask(task, state.model, state.taskModels, {
      provider: state.provider,
      baseUrl: state.baseUrl,
      localOnlyMode: state.localOnlyMode,
      modelDetails: state.modelDetails?.id === activeModel ? state.modelDetails : null,
    });
    if (!suit.suitable && suit.reason) {
      return suit.reason;
    }
  }
  return null;
}

export const isConnected = (s: ConnectionState) => s.status.kind === "connected" && sendBlocker(s) === null;
