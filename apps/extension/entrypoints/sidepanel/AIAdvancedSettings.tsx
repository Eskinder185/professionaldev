import { useEffect, useRef, useState } from "react";
import { AI_TASKS } from "../../../../src/features/ai/taskModels";
import { PROVIDERS, type ProviderId } from "../../../../src/features/ai/providers";
import { validateEndpoint } from "../../../../src/features/ai/endpoint";
import type { AIConnectionSnapshot } from "../../../../packages/careeros-shared/types";
import { loadExtensionState, saveExtensionState } from "../../src/storage/stateStore";
import { CLOUD_PROVIDERS, LOCAL_PROVIDERS, disconnectedSnapshot, discoverExtensionModels, testExtensionModel, validateExtensionDestination } from "../../src/ai/localConnection";

/** The same component is mounted in the side panel and the extension Options page. */
export default function AIAdvancedSettings() {
  const [snapshot, setSnapshot] = useState<AIConnectionSnapshot | null>(null);
  const [provider, setProvider] = useState<ProviderId>("ollama");
  const [baseUrl, setBaseUrl] = useState(PROVIDERS.ollama.defaultBaseUrl);
  const [model, setModel] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const endpoint = validateEndpoint(baseUrl);
  const blocked = validateExtensionDestination(provider, baseUrl);

  useEffect(() => {
    let live = true;
    const load = () => loadExtensionState().then((state) => {
      if (!live) return;
      const s = state.aiConnection;
      setSnapshot(s);
      if (s && s.provider in PROVIDERS) {
        setProvider(s.provider as ProviderId);
        setBaseUrl(s.baseUrl);
        setModel(s.model);
      }
    });
    void load();
    const changed = (globalThis as unknown as { chrome?: { storage?: { onChanged?: { addListener: (cb: () => void) => void; removeListener: (cb: () => void) => void } } } }).chrome?.storage?.onChanged;
    changed?.addListener(load);
    return () => { live = false; changed?.removeListener(load); request.current?.abort(); };
  }, []);

  async function persist(next: AIConnectionSnapshot) {
    await saveExtensionState({ aiConnection: next });
    setSnapshot(next);
  }
  async function changeDestination(nextProvider: ProviderId, nextUrl: string, nextModel = "") {
    request.current?.abort();
    setConsent(false);
    setMessage("");
    setProvider(nextProvider);
    setBaseUrl(nextUrl);
    setModel(nextModel);
    await persist(disconnectedSnapshot(nextProvider, nextUrl, nextModel, snapshot));
  }
  async function changeModel(nextModel: string) {
    request.current?.abort();
    setModel(nextModel);
    await persist(disconnectedSnapshot(provider, baseUrl, nextModel, snapshot));
  }
  async function run(operation: (signal: AbortSignal) => Promise<void>) {
    if (!consent) { setMessage("Confirm the displayed destination before contacting it."); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try { await operation(controller.signal); }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Connection failed."); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  const current = snapshot && snapshot.provider === provider && snapshot.baseUrl === baseUrl && snapshot.model === model ? snapshot : null;
  const options = current?.discoveredModels ?? [];
  return (
    <div className="stack" data-testid="ai-settings">
      <section className="card">
        <h2 className="card-title">AI Connections</h2>
        <p className="muted">Choose a model here. Local requests go directly from the extension to the endpoint you approve.</p>
        <p className="meta" role="status">{blocked ?? (current?.connected ? "Connected to loopback endpoint" : "Disconnected")}</p>
        <div className="field">
          <label className="label" htmlFor="ext-ai-provider">Provider</label>
          <select id="ext-ai-provider" className="input" value={provider} onChange={(event) => { const next = event.target.value as ProviderId; void changeDestination(next, PROVIDERS[next].defaultBaseUrl); }}>
            <optgroup label="Local">{LOCAL_PROVIDERS.map((id) => <option key={id} value={id}>{PROVIDERS[id].label}</option>)}</optgroup>
            <optgroup label="Cloud">{CLOUD_PROVIDERS.map((id) => <option key={id} value={id}>{PROVIDERS[id].label}</option>)}</optgroup>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="ext-ai-endpoint">Endpoint</label>
          <input id="ext-ai-endpoint" className="input" type="url" value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); setConsent(false); }} onBlur={() => { if (baseUrl !== snapshot?.baseUrl) void changeDestination(provider, baseUrl, model); }} />
        </div>
        <div className="field">
          <label className="label" htmlFor="ext-ai-model">Model</label>
          <input id="ext-ai-model" className="input" value={model} list="ext-ai-models" onChange={(event) => { void changeModel(event.target.value); }} placeholder="Exact model ID" />
          <datalist id="ext-ai-models">{options.map((item) => <option key={item.id} value={item.id} />)}</datalist>
        </div>
        <p className="meta">Destination: {endpoint.ok ? endpoint.origin : "Invalid URL"}. A loopback server can forward requests to a cloud service; check its configuration.</p>
        {provider && CLOUD_PROVIDERS.includes(provider) && <p className="banner banner-warning" role="status">Cloud setup required. This extension has no secure credential companion, so it will not send cloud requests or accept API keys.</p>}
        {!blocked && <label className="check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> <span>I authorize this extension to contact {endpoint.ok ? endpoint.host : baseUrl} for model discovery and testing.</span></label>}
        <div className="btn-grid">
          <button type="button" className="btn btn-secondary" disabled={Boolean(blocked) || busy} onClick={() => void run(async (signal) => {
            const found = await discoverExtensionModels(provider, baseUrl, signal);
            await persist({ ...disconnectedSnapshot(provider, baseUrl, model, snapshot), discoveredModels: found });
            setMessage(`Found ${found.length} model(s).`);
          })}>Load models</button>
          <button type="button" className="btn btn-primary" disabled={Boolean(blocked) || busy || !model.trim()} onClick={() => void run(async (signal) => {
            const tested = await testExtensionModel(provider, baseUrl, model, snapshot, signal);
            await persist(tested);
            setMessage("Connection checked. The selected model is available.");
          })}>Test connection</button>
          <button type="button" className="btn btn-secondary" onClick={() => { request.current?.abort(); setBusy(false); }}>Cancel</button>
          <button type="button" className="btn btn-secondary" onClick={() => { void persist(disconnectedSnapshot(provider, baseUrl, model, snapshot)); setConsent(false); setMessage("Disconnected."); }}>Disconnect</button>
        </div>
        {message && <p className="meta" role="status">{message}</p>}
      </section>
      <section className="card">
        <h2 className="card-title">Task models</h2>
        <label className="check"><input type="checkbox" checked={current?.localOnlyMode ?? true} onChange={(event) => { if (current) void persist({ ...current, localOnlyMode: event.target.checked, updatedAt: new Date().toISOString() }); }} /> <span>Local Only: never send career data to a cloud endpoint</span></label>
        <p className="muted">Blank overrides use the default model. Capability badges are estimates; a successful chat test does not prove structured output or safe agent planning.</p>
        {AI_TASKS.map((task) => <div className="field" key={task.id}>
          <label className="label" htmlFor={`ext-task-${task.id}`}>{task.label}</label>
          <input id={`ext-task-${task.id}`} className="input" value={current?.taskModels?.[task.id] ?? ""} placeholder={model || "Default model"} onChange={(event) => {
            if (!current) return;
            const taskModels = { ...current.taskModels };
            if (event.target.value) taskModels[task.id] = event.target.value;
            else delete taskModels[task.id];
            void persist({ ...current, taskModels, updatedAt: new Date().toISOString() });
          }} />
        </div>)}
        {current?.capabilities?.length ? <p className="meta">Estimated capabilities: {current.capabilities.join(", ")}</p> : null}
        <p className="meta">Cloud providers may charge per token. No API key is stored in the extension or sent to a job page.</p>
      </section>
    </div>
  );
}
