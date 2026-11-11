/**
 * Shared AI connection. The API key lives in React state only — never localStorage,
 * sessionStorage, IndexedDB, URLs or exports. Provider, URL and model are remembered only
 * when the user opts in, and come back as "not checked yet" without any permission; nothing
 * is sent on page load.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { AIConnectionSnapshot } from "../../../packages/careeros-shared/types";
import { sendExtensionMessage } from "../autoapply/extensionBridge";
import { AIError, type ChatMessage, type ChatOptions, type ChatResult, type ConnectionTarget } from "./client";
import { clearAIConfig, loadAIConfig, saveAIConfig } from "./configStore";
import {
  connectionReducer,
  effectiveModelForTask,
  initialConnection,
  isConnected,
  sendBlocker,
  type ConnectionAction,
  type ConnectionState,
} from "./connectionState";
import { validateEndpoint } from "./endpoint";
import { PROVIDERS, adapterFor } from "./providers";
import {
  detectModelCapabilities,
  evaluateCloudCredentialStatus,
  evaluateModelSuitabilityForTask,
  type AITaskId,
  type TaskSuitabilityResult,
} from "./taskModels";

const TEST_PROMPT = "In one short sentence, say hello and confirm you can assist with résumé tailoring.";
const INFERENCE_TIMEOUT_MS = 120_000;

export interface AIConnectionValue {
  state: ConnectionState;
  dispatch: React.Dispatch<ConnectionAction>;
  connected: boolean;
  /** Check the server, the model and its details. No text is generated unless model list is unavailable. */
  testConnection(): Promise<boolean>;
  /** Send a short test prompt and stream the reply, measuring latency. */
  runInferenceTest(onToken?: (piece: string) => void): Promise<boolean>;
  loadModels(): Promise<void>;
  cancel(): void;
  /** Forget the key and session results, keep the destination and model. */
  disconnect(): void;
  /** Forget everything, including remembered settings. */
  reset(): void;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  /** Execute a chat request using the task-specific model override (or default model) and validating suitability & Local Only Mode. */
  chatForTask(task: AITaskId, messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  /** Evaluate whether the current configuration & task model are suitable for `task`. */
  getTaskSuitability(task: AITaskId): TaskSuitabilityResult;
  /** Explicitly sync non-secret AI configuration to the AutoApply extension. */
  syncToExtension(): Promise<AIConnectionSnapshot>;
  loadFromExtension(): Promise<boolean>;
}

const Ctx = createContext<AIConnectionValue | null>(null);

const messageOf = (e: unknown) => (e instanceof AIError ? e.message : "Something went wrong. Try again.");

function initState(): ConnectionState {
  const saved = loadAIConfig();
  if (!saved) return initialConnection();
  return {
    ...initialConnection(saved.provider),
    baseUrl: saved.baseUrl,
    model: saved.model,
    localOnlyMode: Boolean(saved.localOnlyMode),
    taskModels: saved.taskModels ?? {},
    restored: true,
    remember: true,
  };
}

export function buildNonSecretSnapshot(state: ConnectionState): AIConnectionSnapshot {
  const preset = PROVIDERS[state.provider];
  const ep = validateEndpoint(state.baseUrl);
  const isLocal = ep.ok ? ep.isLoopback : preset.local;
  const cred = evaluateCloudCredentialStatus(
    state.provider,
    state.baseUrl,
    Boolean(state.apiKey.trim()),
    state.localOnlyMode,
  );
  const caps = detectModelCapabilities(state.model, state.modelDetails, state.provider);
  return {
    provider: state.provider,
    providerLabel: preset.label,
    baseUrl: state.baseUrl,
    model: state.model.trim(),
    connected: isConnected(state),
    isLocal,
    keyless: !preset.keyRequired || isLocal,
    localOnlyMode: state.localOnlyMode,
    taskModels: { ...state.taskModels },
    credentialMode: cred.mode,
    credentialBadge: cred.badgeLabel,
    capabilities: caps.summaryBadges,
    discoveredModels: state.models?.map((m) => ({ id: m.id, parameterSize: m.parameterSize })),
    updatedAt: new Date().toISOString(),
  };
}

export const AIConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(connectionReducer, undefined, initState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inflight = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
  }, []);

  // A destination change invalidates anything still in flight to the old one.
  useEffect(() => cancel, [state.provider, state.baseUrl, cancel]);

  // Remember provider, URL, model, localOnlyMode, and taskModels only when the user opted in. Never the key or permission.
  useEffect(() => {
    if (state.remember) {
      saveAIConfig({
        provider: state.provider,
        baseUrl: state.baseUrl,
        model: state.model,
        localOnlyMode: state.localOnlyMode,
        taskModels: state.taskModels,
      });
    } else {
      clearAIConfig();
    }
  }, [state.provider, state.baseUrl, state.model, state.localOnlyMode, state.taskModels, state.remember]);

  const syncToExtension = useCallback(async (): Promise<AIConnectionSnapshot> => {
    const snap = buildNonSecretSnapshot(stateRef.current);
    await sendExtensionMessage("SYNC_AI_CONFIGURATION", { aiConnection: snap }).catch(() => undefined);
    return snap;
  }, []);

  const loadFromExtension = useCallback(async (): Promise<boolean> => {
    const result = await sendExtensionMessage<unknown, { aiConnection?: AIConnectionSnapshot | null }>("GET_AI_CONFIGURATION", {});
    if (result.transport === "local-protocol" || !result.response.ok || !result.response.data?.aiConnection) return false;
    const snap = result.response.data.aiConnection;
    if (!(snap.provider in PROVIDERS)) return false;
    dispatch({ type: "hydrateSync", config: {
      provider: snap.provider as keyof typeof PROVIDERS,
      baseUrl: snap.baseUrl,
      model: snap.model,
      localOnlyMode: snap.localOnlyMode,
      taskModels: snap.taskModels,
    } });
    return true;
  }, []);

  const target = (s: ConnectionState, modelOverride?: string): ConnectionTarget => {
    const activeModel = (modelOverride ?? s.model).trim();
    return {
      baseUrl: s.baseUrl,
      model: activeModel,
      apiKey: s.apiKey.trim(),
      structured: PROVIDERS[s.provider].structured,
      capabilities: s.modelDetails?.id === activeModel ? s.modelDetails.capabilities : undefined,
    };
  };

  /** Only apply a result if the user hasn't changed destination/model/key meanwhile. */
  const stillCurrent = (snap: ConnectionState) => {
    const now = stateRef.current;
    return now.baseUrl === snap.baseUrl && now.model === snap.model && now.apiKey === snap.apiKey && now.provider === snap.provider;
  };

  const begin = () => {
    cancel();
    const c = new AbortController();
    inflight.current = c;
    return c;
  };
  const end = (c: AbortController) => {
    if (inflight.current === c) inflight.current = null;
  };

  const testConnection = useCallback(async (): Promise<boolean> => {
    const snap = stateRef.current;
    const blocked = sendBlocker(snap);
    if (blocked) {
      dispatch({ type: "status", status: { kind: "error", message: blocked } });
      return false;
    }
    const controller = begin();
    const adapter = adapterFor(snap.provider);
    const t = target(snap);
    const host = validateEndpoint(t.baseUrl).ok ? new URL(t.baseUrl).host : t.baseUrl;
    dispatch({ type: "resetDiagnostics" });
    dispatch({ type: "status", status: { kind: "testing" } });
    let step: "reach" | "model" | "details" = "reach";
    try {
      dispatch({ type: "diagnostic", diagnostic: { id: "reach", label: "Server reachable", state: "running", detail: `Contacting ${host}…` } });
      const probe = await adapter.probe(t, controller.signal);
      if (!stillCurrent(snap)) return false;
      dispatch({ type: "serverVersion", version: probe.version ?? null });
      dispatch({
        type: "diagnostic",
        diagnostic: { id: "reach", label: "Server reachable", state: "ok", detail: probe.version ? `Ollama ${probe.version} answered.` : `${host} answered.`, ms: probe.latencyMs },
      });

      step = "model";
      dispatch({ type: "diagnostic", diagnostic: { id: "model", label: "Model available", state: "running", detail: "Checking installed models…" } });
      const models = await adapter.listModels(t, controller.signal);
      if (!stillCurrent(snap)) return false;
      if (models) {
        dispatch({ type: "models", models });
        if (!models.some((m) => m.id === t.model)) {
          const pull = snap.provider === "ollama" ? ` To download it, run: ollama pull ${t.model}` : "";
          const msg = `The server has no model named “${t.model}”.${models.length ? " Pick an installed model." : ""}${pull}`;
          dispatch({ type: "diagnostic", diagnostic: { id: "model", label: "Model available", state: "fail", detail: msg } });
          dispatch({ type: "status", status: { kind: "error", message: msg } });
          return false;
        }
        dispatch({ type: "diagnostic", diagnostic: { id: "model", label: "Model available", state: "ok", detail: `“${t.model}” is installed.` } });
      } else {
        dispatch({ type: "diagnostic", diagnostic: { id: "model", label: "Model available", state: "skipped", detail: "This server doesn’t list its models. Run a test prompt to confirm the name." } });
      }

      step = "details";
      const details = await adapter.describeModel(t, t.model, controller.signal).catch(() => null);
      if (!stillCurrent(snap)) return false;
      const listed = models?.find((m) => m.id === t.model) ?? null;
      const merged = details || listed ? { ...listed, ...details, id: t.model, capabilities: details?.capabilities ?? listed?.capabilities, contextLength: details?.contextLength ?? listed?.contextLength } : null;
      dispatch({ type: "modelDetails", details: merged });
      dispatch({
        type: "diagnostic",
        diagnostic: merged?.capabilities || merged?.contextLength
          ? { id: "details", label: "Model details", state: "ok", detail: "Capabilities read from the server." }
          : { id: "details", label: "Model details", state: "skipped", detail: "This server doesn’t report model details." },
      });

      if (!models) {
        const ok = await runInference(snap, controller);
        if (!ok) return false;
      }
      dispatch({ type: "status", status: { kind: "connected", checkedAt: Date.now(), detail: `“${t.model}” on ${host} is ready.` } });
      return true;
    } catch (e) {
      if (!stillCurrent(snap)) return false;
      const cancelled = e instanceof AIError && e.kind === "cancelled";
      const labels = { reach: "Server reachable", model: "Model available", details: "Model details" };
      dispatch({ type: "diagnostic", diagnostic: { id: step, label: labels[step], state: "fail", detail: cancelled ? "Cancelled." : messageOf(e) } });
      dispatch({ type: "status", status: cancelled ? { kind: "idle" } : { kind: "error", message: messageOf(e) } });
      return false;
    } finally {
      end(controller);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancel]);

  async function runInference(snap: ConnectionState, controller: AbortController, onToken?: (piece: string) => void): Promise<boolean> {
    const adapter = adapterFor(snap.provider);
    dispatch({ type: "diagnostic", diagnostic: { id: "inference", label: "Test prompt", state: "running", detail: "Waiting for the first words…" } });
    try {
      const result = await adapter.chat(target(stateRef.current), [{ role: "user", content: TEST_PROMPT }], {
        stream: true,
        onToken,
        signal: controller.signal,
        timeoutMs: INFERENCE_TIMEOUT_MS,
      });
      if (!stillCurrent(snap)) return false;
      if (!result.text.trim()) throw new AIError("malformed", "The model replied with no text.");
      const m = result.metrics;
      const parts = [
        m.firstTokenMs != null ? `first words after ${(m.firstTokenMs / 1000).toFixed(1)} s` : null,
        `finished in ${(m.totalMs / 1000).toFixed(1)} s`,
        m.tokensPerSecond ? `${m.tokensPerSecond} tokens/s` : null,
      ].filter(Boolean);
      dispatch({ type: "inference", result: { text: result.text, metrics: m, at: Date.now() } });
      dispatch({ type: "diagnostic", diagnostic: { id: "inference", label: "Test prompt", state: "ok", detail: `Replied: ${parts.join(", ")}.`, ms: m.totalMs } });
      return true;
    } catch (e) {
      if (!stillCurrent(snap)) return false;
      const cancelled = e instanceof AIError && e.kind === "cancelled";
      dispatch({ type: "diagnostic", diagnostic: { id: "inference", label: "Test prompt", state: "fail", detail: cancelled ? "Cancelled." : messageOf(e) } });
      if (!cancelled) dispatch({ type: "status", status: { kind: "error", message: messageOf(e) } });
      throw e;
    }
  }

  const runInferenceTest = useCallback(async (onToken?: (piece: string) => void): Promise<boolean> => {
    const snap = stateRef.current;
    const blocked = sendBlocker(snap);
    if (blocked) {
      dispatch({ type: "status", status: { kind: "error", message: blocked } });
      return false;
    }
    const controller = begin();
    try {
      return await runInference(snap, controller, onToken);
    } catch {
      return false;
    } finally {
      end(controller);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancel]);

  const loadModels = useCallback(async () => {
    const snap = stateRef.current;
    const blocked = sendBlocker(snap, false);
    if (blocked) {
      dispatch({ type: "status", status: { kind: "error", message: blocked } });
      return;
    }
    const controller = begin();
    dispatch({ type: "status", status: { kind: "testing" } });
    try {
      const models = await adapterFor(snap.provider).listModels(target(snap), controller.signal);
      if (!stillCurrent(snap)) return;
      dispatch({ type: "models", models: models ?? [] });
      if (models && models.length > 0 && !stateRef.current.model.trim()) {
        dispatch({ type: "model", model: models[0].id });
      }
      dispatch({
        type: "status",
        status: models
          ? models.length
            ? { kind: "idle" }
            : { kind: "error", message: snap.provider === "ollama" ? "Ollama has no models yet. Download one with: ollama pull <model>" : "The server reported no models." }
          : { kind: "error", message: "This server doesn’t list its models. Type the model name instead." },
      });
    } catch (e) {
      if (!stillCurrent(snap)) return;
      if (e instanceof AIError && e.kind === "cancelled") dispatch({ type: "status", status: { kind: "idle" } });
      else dispatch({ type: "status", status: { kind: "error", message: messageOf(e) } });
    } finally {
      end(controller);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancel]);

  const disconnect = useCallback(() => {
    cancel();
    dispatch({ type: "disconnect" });
  }, [cancel]);

  const reset = useCallback(() => {
    cancel();
    clearAIConfig();
    dispatch({ type: "provider", provider: "ollama" });
    dispatch({ type: "clear" });
  }, [cancel]);

  const chat = useCallback<AIConnectionValue["chat"]>(async (messages, options = {}) => {
    const snap = stateRef.current;
    const blocked = sendBlocker(snap);
    if (blocked) throw new AIError("bad_request", blocked);
    return adapterFor(snap.provider).chat(target(snap), messages, options);
  }, []);

  const chatForTask = useCallback<AIConnectionValue["chatForTask"]>(async (task, messages, options = {}) => {
    const snap = stateRef.current;
    const blocked = sendBlocker(snap, true, task);
    if (blocked) throw new AIError("bad_request", blocked);
    const modelForTask = effectiveModelForTask(snap, task);
    return adapterFor(snap.provider).chat(target(snap, modelForTask), messages, options);
  }, []);

  const getTaskSuitability = useCallback<AIConnectionValue["getTaskSuitability"]>(
    (task) => {
      const activeModel = effectiveModelForTask(state, task);
      return evaluateModelSuitabilityForTask(task, state.model, state.taskModels, {
        provider: state.provider,
        baseUrl: state.baseUrl,
        localOnlyMode: state.localOnlyMode,
        modelDetails: state.modelDetails?.id === activeModel ? state.modelDetails : null,
      });
    },
    [state],
  );

  const value = useMemo<AIConnectionValue>(
    () => ({
      state,
      dispatch,
      connected: isConnected(state),
      testConnection,
      runInferenceTest,
      loadModels,
      cancel,
      disconnect,
      reset,
      chat,
      chatForTask,
      getTaskSuitability,
      syncToExtension,
      loadFromExtension,
    }),
    [
      state,
      testConnection,
      runInferenceTest,
      loadModels,
      cancel,
      disconnect,
      reset,
      chat,
      chatForTask,
      getTaskSuitability,
      syncToExtension,
      loadFromExtension,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

const fallbackValue: AIConnectionValue = {
  state: initialConnection(),
  dispatch: () => undefined,
  connected: false,
  testConnection: async () => false,
  runInferenceTest: async () => false,
  loadModels: async () => undefined,
  cancel: () => undefined,
  disconnect: () => undefined,
  reset: () => undefined,
  chat: async () => {
    throw new AIError("bad_request", "AI connection provider is not mounted.");
  },
  chatForTask: async () => {
    throw new AIError("bad_request", "AI connection provider is not mounted.");
  },
  getTaskSuitability: (task) => evaluateModelSuitabilityForTask(task, "", {}),
  syncToExtension: async () => buildNonSecretSnapshot(initialConnection()),
  loadFromExtension: async () => false,
};

export function useAIConnection(): AIConnectionValue {
  return useContext(Ctx) ?? fallbackValue;
}
