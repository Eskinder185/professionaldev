import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Banner } from "./ui";
import { ModelContext } from "./lib/context";
import AIAdvancedSettings from "./AIAdvancedSettings";
import { CATALOG } from "../../../../src/features/ai/install/catalog";
import { discoverLocalAI, suitabilityFor, type LocalCandidate } from "../../../../src/features/ai/discovery";
import { PROVIDERS, type ProviderId } from "../../../../src/features/ai/providers";
import type { AIConnectionSnapshot } from "../../../../packages/careeros-shared/types";
import { loadExtensionState, saveExtensionState } from "../../src/storage/stateStore";
import {
  checkSavedConnection,
  connectAndTest,
  disconnected,
  guideSteps,
  plainError,
  readDiscoveryConsent,
  summarizeDiscovery,
  writeDiscoveryConsent,
  type FoundService,
  type Os,
  type RankedModel,
  type SetupApp,
  type SetupOutcome,
} from "../../src/ai/localSetup";

/**
 * Connect Your AI. Two choices up front; everything technical lives under Advanced settings.
 * The same component is mounted in the side panel and the extension Options page.
 */

type Step = "home" | "consent" | "searching" | "found" | "none" | "guide" | "cloud" | "ready" | "reconnect";

const plainName = (label: string) => label.replace(/\s*\((local|cloud)\)\s*$/i, "");
const GUIDE_KEY = "careeros:ai-guide";
const CLOUD_CARDS = [
  { id: "openai", name: "OpenAI" },
  { id: "gemini", name: "Google Gemini" },
  { id: "anthropic", name: "Anthropic Claude" },
  { id: "custom_cloud", name: "Custom Cloud Provider" },
] as const;

const storage = () => (globalThis as unknown as { chrome?: { storage?: { local?: { get(k: string): Promise<Record<string, unknown>>; set(o: Record<string, unknown>): Promise<void> } } } }).chrome?.storage?.local;
const defaultOs = (): Os => (typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent) ? "mac" : "windows");

function Spinner() {
  return <span className="spinner" aria-hidden />;
}

export default function AISettingsPanel() {
  const ctx = useContext(ModelContext);
  const [snapshot, setSnapshot] = useState<AIConnectionSnapshot | null>(null);
  const [step, setStep] = useState<Step>("home");
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState("");
  const [outcome, setOutcome] = useState<SetupOutcome | null>(null);
  const [choice, setChoice] = useState<{ service: number; model: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);
  const [problem, setProblem] = useState<{ reason: "service" | "model"; message: string } | null>(null);
  const [guide, setGuide] = useState<{ app: SetupApp; os: Os; step: number }>({ app: "ollama", os: defaultOs(), step: 0 });
  const [guideMiss, setGuideMiss] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus follows the person's own actions inside this screen. Opening the tab, or arrowing along
  // the tab bar, must never pull focus into the content.
  const interacted = useRef(false);

  const persist = useCallback(async (next: AIConnectionSnapshot) => {
    await saveExtensionState({ aiConnection: next });
    setSnapshot(next);
  }, []);

  // Open on the right screen: a saved local connection is checked for real before it is shown as usable.
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    void (async () => {
      const state = await loadExtensionState();
      const saved = (await storage()?.get(GUIDE_KEY))?.[GUIDE_KEY] as typeof guide | undefined;
      if (!live) return;
      if (saved && (saved.app === "ollama" || saved.app === "lmstudio")) setGuide((g) => ({ ...g, ...saved }));
      const s = state.aiConnection;
      setSnapshot(s);
      if (s && s.connected && s.keyless && s.isLocal && s.model) {
        setStep("ready");
        setProgress("Checking your AI…");
        const result = await checkSavedConnection(s, controller.signal);
        if (!live) return;
        setProgress("");
        if (result.ok) setProblem(null);
        else {
          setProblem({ reason: result.reason, message: result.message });
          setStep("reconnect");
        }
      }
      setLoaded(true);
    })();
    return () => {
      live = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    void storage()?.set({ [GUIDE_KEY]: guide });
  }, [guide]);

  // Move focus to the new screen's heading so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (loaded && interacted.current) heading.current?.focus();
  }, [step, loaded]);

  const stop = () => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
  };

  const search = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setNotice("");
    setStep("searching");
    setProgress("Looking for AI on this computer…");
    try {
      const results = await discoverLocalAI({
        signal: controller.signal,
        onStep: (candidate: LocalCandidate, phase) => setProgress(phase === "done" ? "Almost done…" : `Looking for ${candidate.label}…`),
      });
      if (controller.signal.aborted) return;
      const summary = summarizeDiscovery(results);
      setOutcome(summary);
      if (summary.kind === "found") {
        const first = summary.services[0];
        const pick = first.ranked.recommended ?? first.ranked.others[0];
        setChoice(pick ? { service: 0, model: pick.model.id } : null);
        setStep("found");
      } else {
        setStep("none");
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(plainError(e));
        setStep("home");
      } else setStep("home");
    } finally {
      if (abort.current === controller) abort.current = null;
      setProgress("");
    }
  }, []);

  const findMyAI = async () => {
    setError("");
    setNotice("");
    // Someone who already agreed is not asked again. Anyone else is asked first.
    if ((await readDiscoveryConsent()) === "allowed") void search();
    else setStep("consent");
  };

  const allowAndSearch = async () => {
    await writeDiscoveryConsent("allowed");
    void search();
  };
  const declineSearch = async () => {
    await writeDiscoveryConsent("declined");
    setNotice("No problem. Nothing was checked. You can look again any time.");
    setStep("home");
  };

  const selected = useMemo(() => {
    if (!choice || outcome?.kind !== "found") return null;
    const service = outcome.services[choice.service];
    return service ? { service, model: service.models.find((m) => m.id === choice.model) ?? null } : null;
  }, [choice, outcome]);

  const connect = async () => {
    if (!selected?.model) return;
    const { service, model } = selected;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const next = await connectAndTest(service.candidate.provider, service.candidate.baseUrl, model.id, snapshot, controller.signal);
      if (controller.signal.aborted) return;
      await persist({ ...next, discoveredModels: service.models.map((m) => ({ id: m.id, parameterSize: m.parameterSize })) });
      setTested(true);
      setProblem(null);
      setStep("ready");
    } catch (e) {
      if (!controller.signal.aborted) setError(plainError(e));
    } finally {
      if (abort.current === controller) abort.current = null;
      setBusy(false);
    }
  };

  const testAgain = async () => {
    if (!snapshot) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await connectAndTest(snapshot.provider as ProviderId, snapshot.baseUrl, snapshot.model, snapshot, controller.signal);
      if (controller.signal.aborted) return;
      await persist({ ...next, discoveredModels: snapshot.discoveredModels, taskModels: snapshot.taskModels, localOnlyMode: snapshot.localOnlyMode });
      setTested(true);
      setProblem(null);
      setStep("ready");
      setNotice("Your AI answered. Everything is working.");
    } catch (e) {
      if (!controller.signal.aborted) {
        setProblem({ reason: "service", message: plainError(e) });
        setStep("reconnect");
      }
    } finally {
      if (abort.current === controller) abort.current = null;
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (snapshot) await persist(disconnected(snapshot));
    setTested(false);
    setOutcome(null);
    setChoice(null);
    setNotice("Disconnected. Your AI settings were cleared; nothing else changed.");
    setStep("home");
  };

  const setGuideStep = (n: number) => setGuide((g) => ({ ...g, step: n }));
  const checkAgain = async () => {
    setGuideMiss(false);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setProgress("Checking…");
    try {
      const results = await discoverLocalAI({ signal: controller.signal });
      if (controller.signal.aborted) return;
      const summary = summarizeDiscovery(results);
      setOutcome(summary);
      if (summary.kind === "found") {
        const first = summary.services[0];
        const pick = first.ranked.recommended ?? first.ranked.others[0];
        setChoice(pick ? { service: 0, model: pick.model.id } : null);
        setStep("found");
      } else setGuideMiss(true);
    } finally {
      if (abort.current === controller) abort.current = null;
      setBusy(false);
      setProgress("");
    }
  };

  const onStart = () => ctx?.updateUi({ tab: "ask" });

  /* ---------------- screens ---------------- */

  const catalogModel = CATALOG.find((m) => m.key === "qwen3.5-4b") ?? CATALOG[0];

  let screen: JSX.Element;
  switch (step) {
    case "consent":
      screen = (
        <section className="connect-screen" aria-labelledby="c-h" data-testid="ai-consent-step">
          <h2 id="c-h" tabIndex={-1} ref={heading} className="connect-title">Look for AI on this computer?</h2>
          <p>CareerOS will check whether Ollama or LM Studio is running on this computer and see which models they have. Nothing is sent anywhere else.</p>
          <details className="connect-details">
            <summary>What exactly is checked?</summary>
            <p className="meta">Only the two standard addresses on this computer: 127.0.0.1:11434 (Ollama) and 127.0.0.1:1234 (LM Studio). CareerOS doesn’t scan other ports or other devices, and you can take this permission back under Advanced settings.</p>
          </details>
          <div className="row">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void allowAndSearch()} data-testid="ai-allow">Allow and search</button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => void declineSearch()} data-testid="ai-decline">Not now</button>
          </div>
        </section>
      );
      break;
    case "searching":
      screen = (
        <section className="connect-screen" aria-labelledby="s-h" data-testid="ai-searching">
          <h2 id="s-h" tabIndex={-1} ref={heading} className="connect-title">Finding your AI</h2>
          <p className="running" role="status"><Spinner /> {progress}</p>
          <button type="button" className="btn btn-secondary" onClick={() => { stop(); setStep("home"); }}>Stop</button>
        </section>
      );
      break;
    case "found":
      screen = (
        <section className="connect-screen" aria-labelledby="f-h" data-testid="ai-found">
          <h2 id="f-h" tabIndex={-1} ref={heading} className="connect-title">AI found on your computer</h2>
          {outcome?.kind === "found"
            ? outcome.services.map((service, si) => (
                <ServiceCard key={service.candidate.provider} service={service} index={si} choice={choice} onChoose={(model) => setChoice({ service: si, model })} />
              ))
            : null}
          {error ? <Banner tone="danger" testId="ai-error">{error}</Banner> : null}
          {busy ? (
            <p className="running" role="status" data-testid="ai-testing"><Spinner /> Asking {selected?.model?.id} for a quick reply…
              <button type="button" className="btn btn-secondary btn-sm" onClick={stop}>Stop</button>
            </p>
          ) : null}
          <div className="row">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void connect()} disabled={busy || !selected?.model} data-testid="ai-connect">Connect &amp; Test</button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(snapshot?.connected ? "ready" : "home")} disabled={busy}>Back</button>
          </div>
        </section>
      );
      break;
    case "none":
      screen = (
        <section className="connect-screen" aria-labelledby="n-h" data-testid="ai-none">
          <h2 id="n-h" tabIndex={-1} ref={heading} className="connect-title">No running AI service was found.</h2>
          <p>Ollama or LM Studio may not be installed, may be closed, or may be blocked from CareerOS.</p>
          {outcome?.kind === "none" && outcome.empty.length ? <p className="meta">{outcome.empty.map((c) => c.label).join(" and ")} {outcome.empty.length === 1 ? "is" : "are"} running but {outcome.empty.length === 1 ? "has" : "have"} no models yet. Download one to continue.</p> : null}
          {outcome?.kind === "none" ? outcome.problems.map((p) => <Banner key={p.candidate.provider} tone="warning">{p.candidate.label}: {p.message}</Banner>) : null}
          <div className="stack-sm">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { setGuideMiss(false); setStep("guide"); }} data-testid="ai-setup-free">Set Up Free AI</button>
            <button type="button" className="btn btn-secondary" onClick={() => void search()} data-testid="ai-check-again">Check Again</button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("cloud")} data-testid="ai-use-cloud-instead">Use Cloud AI Instead</button>
          </div>
        </section>
      );
      break;
    case "guide": {
      const steps = guideSteps(guide.app, guide.os, { ollama: catalogModel.ollamaTag, lmStudio: catalogModel.lmStudioId });
      const current = Math.min(guide.step, steps.length - 1);
      const last = current === steps.length - 1;
      screen = (
        <section className="connect-screen" aria-labelledby="g-h" data-testid="ai-guide">
          <h2 id="g-h" tabIndex={-1} ref={heading} className="connect-title">Set up free AI</h2>
          <p className="meta">Free, private, and it runs on your computer. CareerOS never installs anything or runs commands for you.</p>
          <div className="seg" role="group" aria-label="Your computer">
            {(["windows", "mac"] as const).map((os) => (
              <button key={os} type="button" className={`seg-btn ${guide.os === os ? "seg-on" : ""}`} aria-pressed={guide.os === os} onClick={() => setGuide((g) => ({ ...g, os }))}>{os === "windows" ? "Windows" : "macOS"}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Which app">
            {(["ollama", "lmstudio"] as const).map((app) => (
              <button key={app} type="button" className={`seg-btn ${guide.app === app ? "seg-on" : ""}`} aria-pressed={guide.app === app} onClick={() => setGuide((g) => ({ ...g, app, step: 0 }))}>{app === "ollama" ? "Ollama" : "LM Studio"}</button>
            ))}
          </div>
          <p className="meta">{guide.app === "ollama" ? "Simplest to set up. Works quietly in the background." : "Has a visual app for browsing and trying models."}</p>
          <ol className="guide-list" aria-label="Setup steps">
            {steps.map((s, i) => (
              <li key={s.title} className={i === current ? "guide-now" : i < current ? "guide-done" : ""} aria-current={i === current ? "step" : undefined}>
                <span className="guide-num" aria-hidden>{i < current ? "✓" : i + 1}</span>
                <div>
                  <p className="guide-title">{s.title}</p>
                  {i === current ? (
                    <>
                      <p className="meta">{s.detail}</p>
                      {s.link ? <a className="btn btn-secondary btn-sm" href={s.link.href} target="_blank" rel="noopener noreferrer">{s.link.label}</a> : null}
                      {s.command ? <CommandBox command={s.command} /> : null}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {guideMiss ? <Banner tone="info" testId="ai-still-missing">Still not finding it. Make sure the app is open{guide.app === "lmstudio" ? " with the server turned on" : ""}, then check again. You’re on step {current + 1}; nothing was reset.</Banner> : null}
          {busy ? <p className="running" role="status"><Spinner /> {progress}</p> : null}
          <div className="row">
            {!last ? <button type="button" className="btn btn-primary" onClick={() => setGuideStep(current + 1)} data-testid="ai-guide-next">Next</button> : null}
            <button type="button" className={`btn ${last ? "btn-primary" : "btn-secondary"}`} onClick={() => void checkAgain()} disabled={busy} data-testid="ai-guide-check">Check Again</button>
            {current > 0 ? <button type="button" className="btn btn-secondary" onClick={() => setGuideStep(current - 1)}>Back</button> : null}
            <button type="button" className="btn btn-secondary" onClick={() => setStep("none")}>Done for now</button>
          </div>
        </section>
      );
      break;
    }
    case "cloud":
      screen = (
        <section className="connect-screen" aria-labelledby="cl-h" data-testid="ai-cloud">
          <h2 id="cl-h" tabIndex={-1} ref={heading} className="connect-title">Use Cloud AI</h2>
          <p className="meta">Online AI services may charge you. CareerOS doesn’t keep API keys in this extension, so cloud setup needs a secure credential service first. Your career data is never sent to a cloud service without your explicit permission.</p>
          <ul className="cloud-grid">
            {CLOUD_CARDS.map((c) => (
              <li key={c.id} className="cloud-card" data-testid={`cloud-${c.id}`}>
                <span className="cloud-name">{c.name}</span>
                <Badge tone="warning">Secure setup required</Badge>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={() => setStep("home")}>Back</button>
            <button type="button" className="btn btn-primary" onClick={() => void findMyAI()}>Find AI on this computer instead</button>
          </div>
        </section>
      );
      break;
    case "reconnect":
      screen = (
        <section className="connect-screen" aria-labelledby="r-h" data-testid="ai-reconnect">
          <h2 id="r-h" tabIndex={-1} ref={heading} className="connect-title">Your AI isn’t responding</h2>
          <Banner tone="warning" testId="ai-problem">{problem?.message ?? "CareerOS couldn’t reach your AI."}</Banner>
          <p className="meta">CareerOS won’t switch to a cloud AI on its own.</p>
          <div className="stack-sm">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void findMyAI()} data-testid="ai-reconnect-btn">Reconnect</button>
            <button type="button" className="btn btn-secondary" onClick={() => void disconnect()}>Disconnect</button>
          </div>
        </section>
      );
      break;
    case "ready": {
      const provider = snapshot ? plainName(PROVIDERS[snapshot.provider as ProviderId]?.label ?? snapshot.providerLabel) : "";
      const suit = snapshot && snapshot.model
        ? suitabilityFor(
            { provider: (snapshot.provider === "lmstudio" ? "lmstudio" : "ollama") as LocalCandidate["provider"], label: provider, baseUrl: snapshot.baseUrl },
            { id: snapshot.model, ...(snapshot.discoveredModels?.find((m) => m.id === snapshot.model) ?? {}) },
          )
        : null;
      screen = (
        <section className="connect-screen" aria-labelledby="y-h" data-testid="ai-ready">
          {progress ? <p className="running" role="status"><Spinner /> {progress}</p> : null}
          <h2 id="y-h" tabIndex={-1} ref={heading} className="connect-title">{tested ? "Your AI is ready" : "Your AI is available"}</h2>
          <dl className="facts" data-testid="ai-facts">
            <div className="fact"><dt>Provider</dt><dd>{provider}</dd></div>
            <div className="fact"><dt>Model</dt><dd data-testid="ai-model">{snapshot?.model}</dd></div>
            <div className="fact"><dt>Where</dt><dd>{snapshot?.isLocal ? "On this computer" : "Cloud"}</dd></div>
            <div className="fact"><dt>Status</dt><dd data-testid="ai-status">{tested ? "Answered a test just now" : "Model found. Not tested this session"}</dd></div>
          </dl>
          {suit ? (
            <p className="meta" data-testid="ai-suit">
              {suit.good.length ? `Works well for ${suit.good.slice(0, 3).join(", ")}.` : ""} {suit.limited.length ? `May struggle with ${suit.limited.slice(0, 2).join(" and ")}.` : ""} One model is used for everything unless you choose otherwise in Advanced settings.
            </p>
          ) : null}
          {notice ? <Banner tone="success">{notice}</Banner> : null}
          {error ? <Banner tone="danger" testId="ai-error">{error}</Banner> : null}
          {busy ? <p className="running" role="status"><Spinner /> Asking your AI for a quick reply…<button type="button" className="btn btn-secondary btn-sm" onClick={stop}>Stop</button></p> : null}
          <div className="stack-sm">
            {ctx ? <button type="button" className="btn btn-primary btn-lg" onClick={onStart} data-testid="ai-start">Start Using CareerOS AI</button> : null}
            <div className="row">
              <button type="button" className="btn btn-secondary" onClick={() => void search()} disabled={busy} data-testid="ai-change-model">Change Model</button>
              <button type="button" className="btn btn-secondary" onClick={() => void testAgain()} disabled={busy} data-testid="ai-test-again">Test Again</button>
              <button type="button" className="btn btn-secondary" onClick={() => void disconnect()} disabled={busy} data-testid="ai-disconnect">Disconnect</button>
            </div>
          </div>
        </section>
      );
      break;
    }
    default:
      screen = (
        <section className="connect-screen" aria-labelledby="h-h" data-testid="ai-home">
          <h2 id="h-h" tabIndex={-1} ref={heading} className="connect-title">Connect Your AI</h2>
          <p className="connect-sub">Let AI help you find jobs, tailor your résumé, and prepare applications.</p>
          {notice ? <Banner tone="info" testId="ai-notice">{notice}</Banner> : null}
          {error ? <Banner tone="danger" testId="ai-error">{error}</Banner> : null}
          <div className="choice-card choice-primary">
            <h3 className="choice-title">Use AI on this computer</h3>
            <p>Use an AI model running on your device. No AI subscription required.</p>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => void findMyAI()} data-testid="ai-find">Find My AI</button>
          </div>
          <div className="choice-card">
            <h3 className="choice-title">Use Cloud AI</h3>
            <p>Connect an online AI service. Provider charges may apply.</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setStep("cloud")} data-testid="ai-choose-cloud">Choose Cloud AI</button>
          </div>
        </section>
      );
  }

  return (
    <div className="stack ai-connect" data-testid="ai-connect-root">
      {!loaded ? <p className="muted" role="status">Loading…</p> : <div className="connect-wrap" key={step} onClickCapture={() => { interacted.current = true; }} onKeyDownCapture={(e) => { if (e.key === "Enter" || e.key === " ") interacted.current = true; }}>{screen}</div>}
      <details className="advanced" data-testid="ai-advanced">
        <summary>Advanced settings</summary>
        <AdvancedExtras refresh={step} />
        <AIAdvancedSettings />
      </details>
    </div>
  );
}

function ServiceCard({ service, index, choice, onChoose }: { service: FoundService; index: number; choice: { service: number; model: string } | null; onChoose: (model: string) => void }) {
  const { ranked, models, candidate } = service;
  const group = (label: string, note: string | null, items: RankedModel[], key: string) =>
    items.length ? (
      <fieldset className="model-group" data-testid={`ai-group-${key}`}>
        <legend>{label}</legend>
        {note ? <p className="meta">{note}</p> : null}
        {items.map((item) => (
          <label key={item.model.id} className={`model-row ${choice?.service === index && choice.model === item.model.id ? "model-on" : ""}`}>
            <input type="radio" name={`model-${index}`} checked={choice?.service === index && choice.model === item.model.id} onChange={() => onChoose(item.model.id)} />
            <span className="model-name">{item.model.id}</span>
            {item.model.parameterSize ? <span className="meta">{item.model.parameterSize}</span> : null}
            {!item.suitable && item.caution ? <span className="meta warn-text">{item.caution}</span> : null}
          </label>
        ))}
      </fieldset>
    ) : null;
  return (
    <div className="service-card" data-testid={`ai-service-${candidate.provider}`}>
      <p className="service-head"><strong>{candidate.label}</strong> — {models.length} model{models.length === 1 ? "" : "s"} available</p>
      {ranked.recommended ? <p className="meta" data-testid="ai-recommended">Recommended for CareerOS: {ranked.recommended.model.id}</p> : <p className="meta" data-testid="ai-none-suitable">None of these models is a confident fit for résumé work. You can still choose one.</p>}
      {group("Recommended", "The most capable model here that suits CareerOS tasks, based on size and structured-output ability reported by the app.", ranked.recommended ? [ranked.recommended] : [], "recommended")}
      {group("Fastest", "The smallest suitable model. Smaller models usually answer sooner.", ranked.fastest ? [ranked.fastest] : [], "fastest")}
      {group("Other available models", null, ranked.others, "others")}
    </div>
  );
}

function CommandBox({ command }: { command: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="cmd" data-testid="ai-command">
      <code>{command}</code>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(command).then(() => { setDone(true); window.setTimeout(() => setDone(false), 1500); })}>{done ? "Copied" : "Copy"}</button>
    </div>
  );
}

/** Authorization management lives with the other technical controls. */
function AdvancedExtras({ refresh }: { refresh: string }) {
  const [consent, setConsent] = useState<string>("…");
  useEffect(() => {
    void readDiscoveryConsent().then((c) => setConsent(c ?? "not asked"));
  }, [refresh]);
  return (
    <div className="stack-sm" data-testid="ai-authorizations">
      <h3 className="sub-title">Authorizations</h3>
      <p className="meta">Permission to look for AI on this computer: <strong data-testid="ai-consent-state">{consent === "allowed" ? "allowed" : consent === "declined" ? "declined" : "not asked yet"}</strong>.</p>
      <button type="button" className="btn btn-secondary btn-sm" disabled={consent !== "allowed"} onClick={() => void import("../../src/ai/localSetup").then((m) => m.revokeDiscoveryConsent()).then(() => setConsent("not asked"))} data-testid="ai-revoke">
        Take back permission
      </button>
    </div>
  );
}
