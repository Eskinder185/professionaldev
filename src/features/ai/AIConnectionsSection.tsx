import React, { useEffect, useId, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Info, Loader2, Lock, Plug, RefreshCw, ShieldCheck, Unplug, X } from "lucide-react";
import { useAIConnection } from "./AIConnectionProvider";
import { validateEndpoint } from "./endpoint";
import { PROVIDER_ORDER, PROVIDERS, type ProviderId } from "./providers";
import {
  AI_TASKS,
  detectModelCapabilities,
  evaluateCloudCredentialStatus,
  evaluateModelSuitabilityForTask,
} from "./taskModels";

/** Settings → AI Connections. Optional; every CareerOS tool works offline without it. */
export const AIConnectionsSection: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { state, dispatch, testConnection, loadModels, cancel, disconnect, connected, syncToExtension, loadFromExtension } = useAIConnection();
  const [showKey, setShowKey] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [urlDraft, setUrlDraft] = useState(state.baseUrl);
  const ids = {
    provider: useId(),
    url: useId(),
    model: useId(),
    modelSelect: useId(),
    key: useId(),
    models: useId(),
    consent: useId(),
    remember: useId(),
    localOnly: useId(),
    urlHint: useId(),
    keyHint: useId(),
  };

  const preset = PROVIDERS[state.provider];
  const endpoint = validateEndpoint(state.baseUrl);
  const isLoopback = endpoint.ok ? endpoint.isLoopback : preset.local;
  const busy = state.status.kind === "testing";
  const consented = endpoint.ok && state.consentFor === endpoint.baseUrl;
  const blockedByLocalOnly = state.localOnlyMode && !isLoopback;
  const credStatus = evaluateCloudCredentialStatus(
    state.provider,
    state.baseUrl,
    Boolean(state.apiKey.trim()),
    state.localOnlyMode,
  );
  const modelCap = detectModelCapabilities(state.model, state.modelDetails, state.provider);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://eskinder185.github.io";

  useEffect(() => setUrlDraft(state.baseUrl), [state.baseUrl]);

  const commitUrl = () => {
    if (urlDraft.trim() !== state.baseUrl) dispatch({ type: "baseUrl", baseUrl: urlDraft.trim() });
  };

  return (
    <section id="ai-connections" className="rs-ai-settings" aria-labelledby="ai-connections-title">
      <div className="rs-ai-settings-head" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 id="ai-connections-title" className="font-semibold text-ink dark:text-white">
            AI Connections
          </h2>
          {!compact && (
            <p className="mt-1 text-sm text-ink-muted">
              Connect a local model (Ollama, LM Studio, or a local server). Cloud providers are listed for future secure setup and cannot be used yet. CareerOS works offline when disconnected.
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            className={`rs-badge ${isLoopback ? "rs-badge-ok" : ""}`}
            data-testid="ai-provider-locality-badge"
          >
            {isLoopback ? "Local (Loopback)" : "Cloud (HTTPS)"}
          </span>
          <span
            className={`rs-badge ${credStatus.ready ? "rs-badge-ok" : ""}`}
            data-testid="ai-credential-security-badge"
            title={credStatus.explanation}
          >
            <ShieldCheck size={12} aria-hidden="true" /> {credStatus.badgeLabel}
          </span>
          <ConnectionBadge />
        </div>
      </div>

      <div className="rs-ai-privacy-box" role="note">
        <Info size={16} aria-hidden="true" />
        <div>
          <p>
            <strong>Privacy & Cloud Credential Security:</strong> Local models can be called from this browser after you approve the destination. Cloud requests are blocked until a secure credential service is implemented. API keys are not stored in browser records, extension storage, content scripts, logs, or backups. Changing the provider or endpoint clears consent and connection status.
          </p>
          <p style={{ marginTop: 4, fontSize: 12 }}>
            <strong>Provider privacy:</strong> {preset.privacySummary} · <strong>Cost & usage:</strong> {preset.costGuidance}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" className="career-secondary-button" onClick={() => void syncToExtension().then(() => setSyncMessage("AI settings sent to the extension if it is connected."))}>Send settings to extension</button>
        <button type="button" className="career-secondary-button" onClick={() => void loadFromExtension().then((ok) => setSyncMessage(ok ? "Extension settings loaded. Test this connection before using it on the website." : "A connected extension did not provide AI settings."))}>Load settings from extension</button>
        {syncMessage && <p role="status" className="career-muted">{syncMessage}</p>}
      </div>

      <div
        className="rs-ai-local-only"
        style={{
          marginBottom: 12,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(148,163,184,0.28)",
          background: state.localOnlyMode ? "rgba(16,185,129,0.08)" : "rgba(148,163,184,0.06)",
        }}
      >
        <label className="rs-check" htmlFor={ids.localOnly} style={{ fontWeight: 600 }}>
          <input
            id={ids.localOnly}
            type="checkbox"
            data-testid="ai-local-only-toggle"
            checked={state.localOnlyMode}
            onChange={(e) => dispatch({ type: "localOnlyMode", value: e.target.checked })}
          />
          <span>
            <Lock size={13} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />
            Local Only Mode — Never send career data, résumés, or transcripts to cloud AI providers
          </span>
        </label>
        {blockedByLocalOnly && (
          <p className="rs-notice" role="alert" style={{ marginTop: 6 }} data-testid="ai-local-only-blocked">
            Local Only Mode is active: requests to <strong>{endpoint.ok ? endpoint.host : state.baseUrl}</strong> are blocked. Switch to a local provider (Ollama / LM Studio on <code>127.0.0.1</code>) or disable Local Only Mode to use cloud AI.
          </p>
        )}
      </div>

      <div className="rs-ai-form">
        <div className="rs-field">
          <label htmlFor={ids.provider}>Provider</label>
          <select
            id={ids.provider}
            data-testid="ai-provider-select"
            value={state.provider}
            onChange={(e) => {
              setShowKey(false);
              dispatch({ type: "provider", provider: e.target.value as ProviderId });
            }}
          >
            {PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>
                {PROVIDERS[id].label} — {PROVIDERS[id].local ? "Local" : "Cloud"}
              </option>
            ))}
          </select>
          <p className="career-muted">{preset.setupHint}</p>
        </div>

        <div className="rs-field">
          <label htmlFor={ids.url}>API endpoint</label>
          <input
            id={ids.url}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={preset.defaultBaseUrl || "https://your-server.example.com/v1"}
            value={urlDraft}
            aria-describedby={ids.urlHint}
            aria-invalid={Boolean(urlDraft.trim()) && !validateEndpoint(urlDraft).ok}
            onChange={(e) => {
              const val = e.target.value;
              setUrlDraft(val);
              if (validateEndpoint(val).ok) dispatch({ type: "baseUrl", baseUrl: val.trim() });
            }}
            onBlur={commitUrl}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitUrl())}
          />
          <p id={ids.urlHint} className="career-muted">
            {!urlDraft.trim()
              ? "Usually ends in /v1."
              : validateEndpoint(urlDraft).ok
                ? "Changing this clears the API key, consent, and connection status."
                : (validateEndpoint(urlDraft) as { error: string }).error}
          </p>
        </div>

        <div className="rs-field">
          <label htmlFor={ids.model}>Selected model</label>
          <div className="rs-ai-inline">
            <input
              id={ids.model}
              autoComplete="off"
              spellCheck={false}
              list={state.models?.length ? ids.models : undefined}
              placeholder={preset.modelPlaceholder}
              value={state.model}
              onChange={(e) => dispatch({ type: "model", model: e.target.value })}
            />
            <button
              type="button"
              className="career-secondary-button"
              onClick={() => void loadModels()}
              disabled={busy || !consented || blockedByLocalOnly}
              title={consented ? "Query available models from the server" : "Confirm the destination below first"}
            >
              <RefreshCw size={14} aria-hidden="true" /> Load models
            </button>
          </div>
          {state.models && state.models.length > 0 && (
            <div className="rs-ai-models-list">
              <label htmlFor={ids.modelSelect}>Available models ({state.models.length})</label>
              <select
                id={ids.modelSelect}
                aria-label="Available models"
                value={state.model}
                onChange={(e) => dispatch({ type: "model", model: e.target.value })}
              >
                <option value="">Select a discovered model…</option>
                {state.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.parameterSize ? ` (${m.parameterSize})` : ""}
                  </option>
                ))}
              </select>
              <datalist id={ids.models}>
                {state.models.map((m) => (
                  <option key={m.id} value={m.id} />
                ))}
              </datalist>
            </div>
          )}

          {/* Model Capabilities display */}
          <div
            className="rs-ai-capabilities"
            data-testid="ai-model-capabilities"
            style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span className="career-muted" style={{ fontSize: 12 }}>Model capabilities:</span>
              {modelCap.summaryBadges.map((b) => (
                <span key={b} className="rs-badge" style={{ fontSize: 11 }}>
                  {b}
                </span>
              ))}
            </div>
            {modelCap.warnings.map((w) => (
              <p key={w} className="career-muted" style={{ fontSize: 12, color: "var(--cos-warning-text)" }}>
                {w}
              </p>
            ))}
          </div>
        </div>

        {!preset.keyRequired && <div className="rs-field">
          <label htmlFor={ids.key}>
            API key {!preset.keyRequired && <span className="career-muted">(optional, memory-only)</span>}
          </label>
          <div className="rs-ai-inline">
            <input
              id={ids.key}
              type={showKey ? "text" : "password"}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              placeholder={preset.keyRequired ? "Paste your key here (or use a 127.0.0.1 companion)" : "Leave empty if not needed"}
              value={state.apiKey}
              aria-describedby={ids.keyHint}
              onChange={(e) => dispatch({ type: "apiKey", apiKey: e.target.value })}
            />
            <button
              type="button"
              className="career-secondary-button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              aria-pressed={showKey}
            >
              {showKey ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>
          <p id={ids.keyHint} className="career-muted">
            {preset.keyHint}
          </p>
          {!credStatus.ready && (
            <p className="career-muted" style={{ fontSize: 12, color: "var(--cos-warning-text)", marginTop: 4 }} data-testid="ai-cloud-setup-required">
              <strong>{credStatus.badgeLabel}:</strong> {credStatus.explanation}
            </p>
          )}
        </div>}
        {preset.keyRequired && <p className="career-muted" data-testid="ai-cloud-setup-required">{credStatus.explanation} Do not paste an API key into this page.</p>}
      </div>

      {/* Phase 5 — Select a Model by Task */}
      <details className="rs-ai-help" style={{ marginTop: 12 }} open={!compact} data-testid="ai-task-models-panel">
        <summary>Select a Model by Task (Default + Per-Task Overrides)</summary>
        <div className="rs-ai-help-body" style={{ display: "grid", gap: 10 }}>
          <p className="career-muted" style={{ fontSize: 12 }}>
            Each workflow uses your <strong>Selected model ({state.model || "none"})</strong> by default, or you can assign a dedicated model per task. Small (<code>&lt;3B</code>) or embedding models are flagged when a task requires strict structured JSON or multi-step agent reasoning.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {AI_TASKS.map((task) => {
              const overrideVal = state.taskModels[task.id] ?? "";
              const suit = evaluateModelSuitabilityForTask(task.id, state.model, state.taskModels, {
                provider: state.provider,
                baseUrl: state.baseUrl,
                localOnlyMode: state.localOnlyMode,
                modelDetails:
                  state.modelDetails?.id === (overrideVal || state.model) ? state.modelDetails : null,
              });
              return (
                <div
                  key={task.id}
                  data-testid={`ai-task-row-${task.id}`}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.25)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <label htmlFor={`task-model-${task.id}`} style={{ fontWeight: 600, fontSize: 12 }}>
                      {task.label}
                    </label>
                    <span
                      className={`rs-badge ${suit.suitable ? "rs-badge-ok" : ""}`}
                      style={{ fontSize: 10 }}
                      data-testid={`ai-task-suitability-${task.id}`}
                    >
                      {suit.suitable ? `Ready (${suit.effectiveModel})` : "Unsuitable / Setup Needed"}
                    </span>
                  </div>
                  <p className="career-muted" style={{ fontSize: 11, margin: 0 }}>
                    {task.description}
                  </p>
                  <input
                    id={`task-model-${task.id}`}
                    data-testid={`ai-task-input-${task.id}`}
                    className="cos-input"
                    type="text"
                    list={state.models?.length ? ids.models : undefined}
                    placeholder={state.model ? `Default (${state.model})` : `Override model for ${task.label}`}
                    value={overrideVal}
                    onChange={(e) => dispatch({ type: "taskModel", task: task.id, model: e.target.value })}
                    style={{ fontSize: 12, padding: "5px 8px" }}
                  />
                  {!suit.suitable && suit.reason && (
                    <span
                      style={{ fontSize: 11, color: "var(--cos-warning-text)" }}
                      data-testid={`ai-task-warning-${task.id}`}
                    >
                      {suit.reason}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </details>

      {endpoint.ok && (
        <div className="rs-ai-consent">
          <p>
            Destination host: <strong>{endpoint.host}</strong> (<code>{endpoint.baseUrl}</code>)
          </p>
          <ul className="rs-ai-consent-list">
            {endpoint.isLoopback ? (
              <li>
                This address points to your own device (<code>localhost</code> / <code>127.0.0.1</code>). Note: connecting to localhost does not guarantee offline execution if your local server is configured to route requests to a cloud model.
              </li>
            ) : (
              <li>
                Requests are sent over HTTPS to <strong>{endpoint.host}</strong> and handled under that provider’s terms.
              </li>
            )}
            <li>Nothing is transmitted until you check the consent box below and click an AI action button.</li>
          </ul>
          <label className="rs-check" htmlFor={ids.consent}>
            <input
              id={ids.consent}
              type="checkbox"
              checked={consented}
              disabled={blockedByLocalOnly}
              onChange={(e) => dispatch({ type: "consent", value: e.target.checked })}
            />
            <span>
              Allow CareerOS to send requests to <strong>{endpoint.host}</strong>
            </span>
          </label>
        </div>
      )}

      <div className="rs-ai-actions">
        {busy ? (
          <button type="button" className="career-secondary-button" onClick={cancel}>
            <X size={14} aria-hidden="true" /> Cancel
          </button>
        ) : (
          <button
            type="button"
            className="career-quick-create"
            onClick={() => void testConnection()}
            disabled={!consented || blockedByLocalOnly}
          >
            <Plug size={14} aria-hidden="true" /> Test connection
          </button>
        )}
        <button
          type="button"
          className="career-secondary-button"
          data-testid="ai-disconnect-btn"
          onClick={() => {
            setShowKey(false);
            disconnect();
          }}
        >
          <Unplug size={14} aria-hidden="true" /> Disconnect
        </button>
        <button
          type="button"
          className="career-secondary-button"
          onClick={() => {
            cancel();
            setShowKey(false);
            dispatch({ type: "clear" });
          }}
        >
          Clear connection
        </button>
      </div>

      <StatusLine connected={connected} />

      <div className="rs-ai-remember">
        <label className="rs-check" htmlFor={ids.remember}>
          <input
            id={ids.remember}
            type="checkbox"
            checked={state.remember}
            onChange={(e) => dispatch({ type: "remember", value: e.target.checked })}
          />
          <span>Remember provider, endpoint, model name, Local Only Mode, and task models on this device (never stores API key or consent)</span>
        </label>
      </div>

      {state.diagnostics.length > 0 && (
        <ul className="rs-ai-diagnostics" aria-label="Connection diagnostics">
          {state.diagnostics.map((d) => (
            <li key={d.id} className={`rs-diag-${d.state}`}>
              <strong>{d.label}:</strong> {d.detail} {d.ms != null ? `(${d.ms} ms)` : ""}
            </li>
          ))}
        </ul>
      )}

      <details className="rs-ai-help">
        <summary>GitHub Pages & Local AI Setup (CORS, Local Network Access & Secure Companion)</summary>
        <div className="rs-ai-help-body">
          <p>
            CareerOS connects directly from your browser to your AI server with no middleman proxy. When running on{" "}
            <code>{origin}</code> (HTTPS) and connecting to a local server on <code>http://127.0.0.1</code>:
          </p>
          <ul>
            <li>
              <strong>Ollama CORS (<code>OLLAMA_ORIGINS</code>):</strong> Set the environment variable{" "}
              <code>OLLAMA_ORIGINS={origin}</code> (or <code>OLLAMA_ORIGINS=https://eskinder185.github.io,http://localhost:5173</code>) and restart Ollama so it permits requests from this site. Keep Ollama bound to <code>127.0.0.1</code>.
            </li>
            <li>
              <strong>LM Studio CORS:</strong> Open LM Studio → Developer tab → Server Settings → enable <strong>Enable CORS</strong>.
            </li>
            <li>
              <strong>Cloud providers:</strong> Setup is pending. A loopback URL alone does not verify a companion or credential protection. CareerOS will block cloud calls until authenticated transport and OS credential storage are implemented and tested.
            </li>
          </ul>
        </div>
      </details>
    </section>
  );
};

export const ConnectionBadge: React.FC = () => {
  const { state, connected } = useAIConnection();
  const preset = PROVIDERS[state.provider];
  const ep = validateEndpoint(state.baseUrl);
  const isLoopback = ep.ok ? ep.isLoopback : preset.local;
  const cred = evaluateCloudCredentialStatus(
    state.provider,
    state.baseUrl,
    Boolean(state.apiKey.trim()),
    state.localOnlyMode,
  );
  if (state.status.kind === "testing") {
    return (
      <span className="rs-badge" data-testid="ai-connection-status">
        <Loader2 size={13} className="rs-spin" aria-hidden="true" /> Checking…
      </span>
    );
  }
  if (connected) {
    return (
      <span className="rs-badge rs-badge-ok" data-testid="ai-connection-status">
        <CheckCircle2 size={13} aria-hidden="true" /> Connected ({state.model})
      </span>
    );
  }
  if (!isLoopback && !cred.ready) {
    return (
      <span className="rs-badge" data-testid="ai-connection-status">
        Setup Required ({preset.label})
      </span>
    );
  }
  return (
    <span className="rs-badge" data-testid="ai-connection-status">
      Disconnected (Offline mode)
    </span>
  );
};

const StatusLine: React.FC<{ connected: boolean }> = ({ connected }) => {
  const { state } = useAIConnection();
  const s = state.status;
  return (
    <div className="rs-ai-status" aria-live="polite" data-testid="ai-status-line">
      {s.kind === "testing" && (
        <p className="rs-ai-status-row">
          <Loader2 size={15} className="rs-spin" aria-hidden="true" /> Contacting the server…
        </p>
      )}
      {s.kind === "connected" && connected && (
        <p className="rs-ai-status-row rs-ai-status-ok">
          <CheckCircle2 size={15} aria-hidden="true" /> <span>Connected. {s.detail}</span>
        </p>
      )}
      {s.kind === "error" && (
        <p className="rs-ai-status-row rs-ai-status-err">
          <AlertTriangle size={15} aria-hidden="true" /> <span>{s.message}</span>
        </p>
      )}
    </div>
  );
};
