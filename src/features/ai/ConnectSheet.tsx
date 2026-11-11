import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, Cpu, Download, Loader2, RefreshCw, X } from "lucide-react";
import { useModalFocus } from "../../hooks/useModalFocus";
import type { ModelInfo } from "./client";
import { validateEndpoint } from "./endpoint";
import { useAIConnection } from "./AIConnectionProvider";
import {
  LOCAL_CANDIDATES,
  discoverLocalAI,
  formatSize,
  readDiscoveryConsent,
  suitabilityFor,
  writeDiscoveryConsent,
  type DiscoveryResult,
  type LocalCandidate,
} from "./discovery";
import CloudProviders from "./CloudProviders";
import type { InstallApp } from "./install/catalog";
import InstallWizard from "./install/InstallWizard";
import SiteAccessHelp from "./install/SiteAccessHelp";

type Phase = "consent" | "declined" | "checking" | "results" | "connecting" | "ready" | "problem";
type Step = "reaching" | "replying";
export type SheetView = "connect" | "install" | "cloud";
type View = SheetView;

type Plan = { id: number; candidate: LocalCandidate; model: ModelInfo };

/** One plain sentence about what this model is suited to. */
export function fitSummary(good: string[], limited: string[]): string {
  if (!limited.length) return "Suited to everything CareerOS does.";
  if (good.length >= limited.length) return "Good for most CareerOS tasks.";
  if (good.length) return `Best for ${good.slice(0, 2).join(" and ")}.`;
  return "Too small for most CareerOS tasks.";
}

function ModelCard({ candidate, model, recommended, onUse }: { candidate: LocalCandidate; model: ModelInfo; recommended: boolean; onUse: () => void }) {
  const size = formatSize(model.sizeBytes);
  const { good, limited } = suitabilityFor(candidate, model);
  return (
    <li className="ai-model">
      <div className="ai-model-main">
        <strong>
          {model.id} {recommended ? <span className="cos-chip cos-chip-info cos-chip-plain">The one you chose</span> : null}
        </strong>
        <span className="cos-muted">{[candidate.label, size, model.parameterSize].filter(Boolean).join(" · ")}</span>
        <span className="ai-model-fit">{fitSummary(good, limited)}</span>
        {limited.length ? <span className="ai-model-limit">May struggle with {limited.slice(0, 2).join(" and ")}.</span> : null}
      </div>
      <button type="button" className="cos-btn cos-btn-primary" aria-label={`Use ${model.id}`} onClick={onUse}>
        Use this model
      </button>
    </li>
  );
}

type Props = { onClose: () => void; initialView?: SheetView };

export default function ConnectSheet({ onClose, initialView = "connect" }: Props) {
  const { state, dispatch, testConnection, runInferenceTest, cancel } = useAIConnection();
  const [view, setView] = useState<View>(initialView);
  const [preferred, setPreferred] = useState<{ app: InstallApp; modelId: string } | null>(null);
  const [phase, setPhase] = useState<Phase>(() => {
    // Someone who already agreed goes straight to checking; no flash of the question.
    const consent = readDiscoveryConsent();
    return consent === "declined" ? "declined" : consent === "allowed" ? "checking" : "consent";
  });
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [current, setCurrent] = useState<{ provider: string; phase: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState<Step>("reaching");
  const [reply, setReply] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [remember, setRemember] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const planCounter = useRef(0);
  const ranFor = useRef(0);
  const alive = useRef(true);
  const requestClose = useCallback(() => {
    controller.current?.abort();
    cancel();
    onClose();
  }, [cancel, onClose]);
  const dialogRef = useModalFocus(true, requestClose);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  const detect = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setResults([]);
    setCurrent(null);
    setPhase("checking");
    const found = await discoverLocalAI({ signal: next.signal, onStep: (candidate, p) => alive.current && setCurrent({ provider: candidate.provider, phase: p }) });
    if (!alive.current || next.signal.aborted) return;
    setResults(found);
    setPhase("results");
  }, []);

  // A person who already agreed does not have to agree again; one who has not sees the question first.
  // (Never from the cloud view: opening that must not touch this computer.)
  useEffect(() => {
    if (initialView === "connect" && readDiscoveryConsent() === "allowed") void detect();
  }, [detect, initialView]);

  const allow = () => {
    writeDiscoveryConsent("allowed");
    void detect();
  };
  const decline = () => {
    writeDiscoveryConsent("declined");
    onClose();
  };

  /** Leave the install helper and look for the AI, asking first if the person has not agreed yet. */
  const startConnect = (choice: { app: InstallApp; modelId: string } | null) => {
    setPreferred(choice);
    setView("connect");
    const consent = readDiscoveryConsent();
    if (consent === "allowed") void detect();
    else setPhase(consent === "declined" ? "declined" : "consent");
  };

  const choose = (candidate: LocalCandidate, model: ModelInfo) => {
    planCounter.current += 1;
    dispatch({ type: "destination", provider: candidate.provider, baseUrl: candidate.baseUrl });
    dispatch({ type: "model", model: model.id });
    // The person agreed above to CareerOS contacting this exact address.
    dispatch({ type: "consent", value: true });
    dispatch({ type: "remember", value: remember });
    setReply("");
    setElapsedMs(null);
    setStep("reaching");
    setPlan({ id: planCounter.current, candidate, model });
    setPhase("connecting");
  };

  // Once the connection state reflects the choice, run a real check and a real test message.
  useEffect(() => {
    if (!plan || phase !== "connecting" || ranFor.current === plan.id) return;
    const endpoint = validateEndpoint(plan.candidate.baseUrl);
    if (!endpoint.ok || state.consentFor !== endpoint.baseUrl || state.model !== plan.model.id || state.provider !== plan.candidate.provider) return;
    ranFor.current = plan.id;
    void (async () => {
      const reached = await testConnection();
      if (!alive.current) return;
      if (!reached) return setPhase("problem");
      setStep("replying");
      const started = performance.now();
      const ok = await runInferenceTest((piece) => alive.current && setReply((text) => text + piece));
      if (!alive.current) return;
      setElapsedMs(Math.round(performance.now() - started));
      setPhase(ok ? "ready" : "problem");
    })();
  }, [plan, phase, state.consentFor, state.model, state.provider, testConnection, runInferenceTest]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const found = results.filter((r): r is Extract<DiscoveryResult, { status: "found" }> => r.status === "found");
  const empty = results.filter((r) => r.status === "empty");
  const problems = results.filter((r): r is Extract<DiscoveryResult, { status: "problem" }> => r.status === "problem");
  const unreachable = results.filter((r) => r.status === "unreachable");
  const isPreferred = (candidate: LocalCandidate, model: ModelInfo) => preferred !== null && preferred.app === candidate.provider && model.id.toLowerCase() === preferred.modelId.toLowerCase();

  const shell = (title: string, body: React.ReactNode) => (
    <div className="cos-overlay" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <div className="cos-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title" ref={dialogRef}>
        <div className="cos-dialog-head">
          <h2 id="connect-title">{title}</h2>
          <button type="button" className="cos-icon-btn" aria-label="Close dialog" onClick={requestClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {body}
      </div>
    </div>
  );

  if (view === "cloud") return shell("Use a cloud AI", <CloudProviders onUseLocal={() => startConnect(preferred)} />);
  if (view === "install") return shell("Set up a local AI", <InstallWizard onExit={() => startConnect(preferred)} onConnect={startConnect} />);

  return shell(
    "Connect your AI",
    <>
      <div className="cos-dialog-body">
        {phase === "consent" ? (
          <>
            <p>
              CareerOS can check whether an AI app is running on this computer. It only checks the standard addresses for Ollama and LM Studio. Nothing leaves your computer.
            </p>
            <ul className="ai-addresses" aria-label="Addresses that will be checked">
              {LOCAL_CANDIDATES.map((c) => (
                <li key={c.provider}>
                  <strong>{c.label}</strong> <code>{new URL(c.baseUrl).host}</code>
                </li>
              ))}
            </ul>
            <p className="cos-muted">
              Don’t have one yet? <button type="button" className="cos-link" onClick={() => setView("install")}>Set up a local AI</button>. Prefer a cloud AI? <button type="button" className="cos-link" onClick={() => setView("cloud")}>See cloud options</button>. A different address? Use <Link to="/settings#ai-connections" onClick={onClose}>AI settings</Link>.
            </p>
          </>
        ) : null}

        {phase === "declined" ? (
          <div className="cos-notice cos-notice-info" role="note">
            <Cpu size={16} aria-hidden="true" />
            <span>
              You chose not to check this computer, so CareerOS hasn’t. You can change your mind any time, <button type="button" className="cos-link" onClick={() => setView("install")}>set up a local AI</button>, or enter a connection yourself in <Link to="/settings#ai-connections" onClick={onClose}>AI settings</Link>.
            </span>
          </div>
        ) : null}

        {phase === "checking" ? (
          <div role="status" aria-live="polite" className="ai-checking">
            <div className="cos-progress" data-indeterminate="true" aria-hidden="true"><span /></div>
            <ul className="ai-check-list">
              {LOCAL_CANDIDATES.map((c) => {
                const done = results.find((r) => r.candidate.provider === c.provider);
                const active = current?.provider === c.provider;
                const index = LOCAL_CANDIDATES.findIndex((x) => x.provider === c.provider);
                const currentIndex = LOCAL_CANDIDATES.findIndex((x) => x.provider === current?.provider);
                const waiting = !done && !active && index > currentIndex;
                return (
                  <li key={c.provider}>
                    {active ? <Loader2 size={15} className="cos-spinner-icon" aria-hidden="true" /> : waiting ? <span className="ai-dot" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                    <span>{c.label}: {active ? (current?.phase === "listing" ? "looking for models…" : "checking…") : waiting ? "waiting" : "checked"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {phase === "results" ? (
          <div role="status" aria-live="polite" className="ai-results">
            {found.map((r) => (
              <section key={r.candidate.provider} aria-labelledby={`found-${r.candidate.provider}`}>
                <h3 id={`found-${r.candidate.provider}`}>
                  <span className="cos-chip cos-chip-success">{r.candidate.label} is running</span>
                </h3>
                <ul className="ai-models">
                  {r.models.map((model) => (
                    <ModelCard key={model.id} candidate={r.candidate} model={model} recommended={isPreferred(r.candidate, model)} onUse={() => choose(r.candidate, model)} />
                  ))}
                </ul>
              </section>
            ))}

            {empty.map((r) => (
              <div className="cos-notice cos-notice-warning" key={r.candidate.provider}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  <strong>{r.candidate.label} is running, but it has no models yet.</strong> A model needs to be downloaded first. Download one in {r.candidate.label}, then press Check again.
                </span>
              </div>
            ))}

            {problems.map((r) => (
              <div className="cos-notice cos-notice-danger" key={r.candidate.provider}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  <strong>{r.candidate.label} answered, but CareerOS couldn’t use it.</strong> {r.message}
                </span>
              </div>
            ))}

            {!found.length && !empty.length && !problems.length ? (
              <div className="cos-notice cos-notice-info">
                <Cpu size={16} aria-hidden="true" />
                <span>
                  <strong>No AI app answered on this computer.</strong> That usually means Ollama or LM Studio isn’t open right now. If you’ve installed one, open it and press Check again.
                </span>
              </div>
            ) : null}

            {!found.length ? (
              <div>
                <button type="button" className="cos-btn cos-btn-primary" onClick={() => setView("install")}>
                  <Download size={15} aria-hidden="true" /> {empty.length ? "Help me get a model" : "Help me install one"}
                </button>
              </div>
            ) : null}

            {found.length && unreachable.length ? (
              <p className="cos-muted">{unreachable.map((r) => r.candidate.label).join(" and ")} {unreachable.length > 1 ? "weren’t" : "wasn’t"} detected, which is fine if you don’t use {unreachable.length > 1 ? "them" : "it"}.</p>
            ) : null}

            {!found.length && unreachable.length ? (
              <details className="ai-fix">
                <summary>Open but still not found?</summary>
                <SiteAccessHelp origin={origin} apps={unreachable.map((r) => r.candidate.provider)} />
              </details>
            ) : null}
          </div>
        ) : null}

        {phase === "connecting" ? (
          <div role="status" aria-live="polite" className="ai-connecting">
            <div className="cos-progress" data-indeterminate="true" aria-hidden="true"><span /></div>
            <ol className="ai-steps">
              <li data-state={step === "reaching" ? "current" : "done"}>Reaching {plan?.candidate.label}</li>
              <li data-state={step === "replying" ? "current" : "pending"}>Asking {plan?.model.id} to say hello</li>
            </ol>
            {reply ? <blockquote className="ai-reply">{reply}</blockquote> : null}
          </div>
        ) : null}

        {phase === "ready" ? (
          <div role="status" aria-live="polite" className="ai-ready">
            <div className="cos-notice cos-notice-success">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>
                <strong>{plan?.model.id} replied. Your AI is ready.</strong> It runs on this computer through {plan?.candidate.label}.
              </span>
            </div>
            <blockquote className="ai-reply">{reply || "(The model replied without text.)"}</blockquote>
            <p className="cos-muted">{elapsedMs !== null ? `Replied in ${elapsedMs < 1000 ? `${elapsedMs} ms` : `${(elapsedMs / 1000).toFixed(1)} seconds`}. ` : ""}This was a real message to your model, not a simulation.</p>
            {remember ? <p className="cos-muted">CareerOS will remember this choice on this device. Nothing secret is saved.</p> : null}
          </div>
        ) : null}

        {phase === "problem" ? (
          <div role="alert" className="cos-notice cos-notice-danger">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              <strong>{plan?.candidate.label} didn’t respond as expected.</strong>{" "}
              {state.status.kind === "error" ? state.status.message : "The test message didn’t get a reply."} Check that {plan?.candidate.label} is still open and the model has finished loading, then try again.
            </span>
          </div>
        ) : null}

        {phase === "results" && found.length ? (
          <label className="cos-check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Remember my choice on this device
          </label>
        ) : null}
      </div>

      <div className="cos-dialog-foot">
        <div className="ai-foot-left">
          {phase === "results" || phase === "problem" ? (
            <button type="button" className="cos-btn" onClick={() => void detect()}>
              <RefreshCw size={15} aria-hidden="true" /> Check again
            </button>
          ) : null}
        </div>
        <div className="ai-foot-right">
          {phase === "consent" ? (
            <>
              <button type="button" className="cos-btn" onClick={decline}>Not now</button>
              <button type="button" className="cos-btn cos-btn-primary" onClick={allow}>Allow and check</button>
            </>
          ) : phase === "declined" ? (
            <>
              <button type="button" className="cos-btn" onClick={onClose}>Close</button>
              <button type="button" className="cos-btn cos-btn-primary" onClick={allow}>Allow and check</button>
            </>
          ) : phase === "ready" ? (
            <>
              <button type="button" className="cos-btn" onClick={() => void detect()}>Switch model</button>
              <button type="button" className="cos-btn cos-btn-primary" onClick={onClose}>Done</button>
            </>
          ) : (
            <button type="button" className="cos-btn" onClick={requestClose}>{phase === "connecting" ? "Cancel" : "Close"}</button>
          )}
        </div>
      </div>
    </>,
  );
}
