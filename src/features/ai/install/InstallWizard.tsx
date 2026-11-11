import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Apple, ExternalLink, Monitor, RotateCcw } from "lucide-react";
import { getLocal, setLocal } from "../../../hooks/useLocal";
import { CATALOG, CATALOG_VERIFIED_ON, SOURCES, modelId, sizeLabel, type CatalogModel, type InstallApp } from "./catalog";
import CopyButton from "./CopyButton";
import { recommend, toNumber, type Fit, type GpuKind, type Hardware } from "./recommend";
import SiteAccessHelp from "./SiteAccessHelp";

type Os = "windows" | "mac";

interface Saved {
  v: 1;
  step: number;
  os: Os | null;
  app: InstallApp | null;
  /** Hardware answers as typed in the form: "" means "not sure". */
  ram: string;
  gpu: GpuKind;
  vram: string;
  disk: string;
  model: CatalogModel["key"] | null;
  done: Record<"get" | "open" | "model" | "server", boolean>;
}

export const WIZARD_KEY = "pd:careeros:ai-install-wizard";
export const STEPS = ["Your computer", "The app", "Your hardware", "Your model", "Install", "Connect"] as const;

const detectOs = (): Os => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac/i.test(nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent ?? "") ? "mac" : "windows";
};

const fresh = (): Saved => ({ v: 1, step: 1, os: detectOs(), app: null, ram: "", gpu: "unknown", vram: "", disk: "", model: null, done: { get: false, open: false, model: false, server: false } });

function load(): Saved {
  const stored = getLocal<Partial<Saved> | null>(WIZARD_KEY, null);
  const base = fresh();
  if (!stored || stored.v !== 1) return base;
  return { ...base, ...stored, step: Math.min(6, Math.max(1, Number(stored.step) || 1)), done: { ...base.done, ...(stored.done ?? {}) } };
}

export const clearWizard = () => setLocal(WIZARD_KEY, null);

const hardwareOf = (s: Saved): Hardware => ({ ramGb: toNumber(s.ram), gpu: s.gpu, vramGb: toNumber(s.vram), diskGb: toNumber(s.disk) });

const FIT_CHIP: Record<Fit, { tone: string; text: string }> = {
  fast: { tone: "success", text: "Should run well" },
  slow: { tone: "warning", text: "Runs slowly" },
  no: { tone: "danger", text: "Won’t fit" },
  unknown: { tone: "plain", text: "Add your hardware to check" },
};

function Choice({ checked, onSelect, title, detail, icon, badge, disabled }: { checked: boolean; onSelect: () => void; title: string; detail: string; icon?: React.ReactNode; badge?: string; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={checked} aria-disabled={disabled || undefined} className="cos-choice" onClick={() => !disabled && onSelect()}>
      <span className="ai-choice-head">{icon}<strong>{title}</strong>{badge ? <span className="cos-chip cos-chip-info cos-chip-plain">{badge}</span> : null}</span>
      <span>{detail}</span>
    </button>
  );
}

function Select({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; hint?: string }) {
  const id = useId();
  return (
    <div className="cos-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={hint ? `${id}-hint` : undefined}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </div>
  );
}

type Props = {
  /** Leave the wizard without connecting. */
  onExit: () => void;
  /** Move on to detection, optionally highlighting the model the person chose. */
  onConnect: (preferred: { app: InstallApp; modelId: string } | null) => void;
};

export default function InstallWizard({ onExit, onConnect }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [saved, setSaved] = useState<Saved>(load);
  const update = (change: Partial<Saved>) => setSaved((current) => ({ ...current, ...change }));
  useEffect(() => setLocal(WIZARD_KEY, saved), [saved]);
  // Move focus to the step heading when the step changes, so screen readers announce where they are.
  useEffect(() => headingRef.current?.focus(), [saved.step]);

  const app = saved.app;
  const hardware = useMemo(() => hardwareOf(saved), [saved]);
  const result = useMemo(() => (app ? recommend(hardware, app) : null), [hardware, app]);
  const chosen = CATALOG.find((m) => m.key === saved.model) ?? null;
  const chosenFit = result?.all.find((item) => item.model.key === saved.model);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Keep the selected model valid: pick the recommendation when nothing is chosen, or when the
  // hardware answers change so that the earlier choice no longer fits.
  const pickKey = result?.pick?.model.key ?? null;
  useEffect(() => {
    if (saved.step < 4 || !result) return;
    const current = result.all.find((item) => item.model.key === saved.model);
    if (!saved.model || !current || current.fit === "no" || current.diskOk === false) setSaved((s) => ({ ...s, model: pickKey }));
  }, [saved.step, saved.model, result, pickKey]);

  const step = saved.step;
  const canNext = step === 1 ? saved.os !== null : step === 2 ? saved.app !== null : step === 4 ? saved.model !== null : true;
  const go = (next: number) => update({ step: Math.min(6, Math.max(1, next)) });
  const needsVram = saved.gpu === "nvidia" || saved.gpu === "amd";

  return (
    <>
      <div className="cos-dialog-body">
        <ol className="cos-stepper" aria-label="Setup progress">
          {STEPS.map((name, index) => (
            <li key={name} data-state={index + 1 < step ? "done" : index + 1 === step ? "current" : "todo"} aria-current={index + 1 === step ? "step" : undefined}>
              <span>{name}</span>
            </li>
          ))}
        </ol>
        <p className="ai-step-count" aria-live="polite">Step {step} of {STEPS.length}</p>
        <h3 className="ai-step-title" tabIndex={-1} ref={headingRef}>
          {step === 1 ? "What kind of computer do you have?" : step === 2 ? "Which app should run your AI?" : step === 3 ? "Tell us about your computer" : step === 4 ? "Choose a model" : step === 5 ? "Install it" : "Connect it to CareerOS"}
        </h3>

        {step === 1 ? (
          <>
            <div className="cos-choices" role="radiogroup" aria-label="Your computer">
              <Choice checked={saved.os === "windows"} onSelect={() => update({ os: "windows" })} title="Windows" detail="A Windows 10 or 11 PC." icon={<Monitor size={18} aria-hidden="true" />} badge={detectOs() === "windows" ? "Looks like yours" : undefined} />
              <Choice checked={saved.os === "mac"} onSelect={() => update({ os: "mac" })} title="macOS" detail="A Mac. Apple silicon (M1 or newer) works best." icon={<Apple size={18} aria-hidden="true" />} badge={detectOs() === "mac" ? "Looks like yours" : undefined} />
            </div>
            <p className="cos-muted">Using Linux? Ollama supports it; see <a href={SOURCES.ollamaDownload} target="_blank" rel="noopener noreferrer">its download page</a>.</p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="cos-choices" role="radiogroup" aria-label="AI app">
              <Choice checked={app === "lmstudio"} onSelect={() => update({ app: "lmstudio" })} title="LM Studio" detail="A regular app window. You browse and download models by clicking. Easiest if you’d rather not use a terminal." badge="Easiest" />
              <Choice checked={app === "ollama"} onSelect={() => update({ app: "ollama" })} title="Ollama" detail="Light and quiet; it runs in the background. You add models by pasting a short command." />
            </div>
            <p className="cos-muted">Both are free, run on your computer, and work with CareerOS. You can switch later.</p>
            {!app ? <p className="cos-muted" role="note">Choose one to continue.</p> : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="cos-notice cos-notice-info" role="note">
              <Monitor size={16} aria-hidden="true" />
              <span>A website can’t see your computer’s memory or graphics card, so we ask. “Not sure” is fine; we’ll pick a safe size and say so.</span>
            </div>
            <div className="ai-form-grid">
              <Select label="Memory (RAM)" value={saved.ram} onChange={(ram) => update({ ram })} options={[["", "Not sure"], ["4", "4 GB"], ["8", "8 GB"], ["16", "16 GB"], ["24", "24 GB"], ["32", "32 GB"], ["64", "64 GB or more"]]} />
              <Select label="Graphics card" value={saved.gpu} onChange={(gpu) => update({ gpu: gpu as GpuKind, vram: gpu === "nvidia" || gpu === "amd" ? saved.vram : "" })} options={[["unknown", "Not sure"], ["none", "No separate graphics card"], ["nvidia", "NVIDIA"], ["amd", "AMD"], ["apple", "Apple silicon (M-series)"]]} />
              {needsVram ? <Select label="Graphics memory (VRAM)" value={saved.vram} onChange={(vram) => update({ vram })} options={[["", "Not sure"], ["4", "4 GB"], ["6", "6 GB"], ["8", "8 GB"], ["12", "12 GB"], ["16", "16 GB"], ["24", "24 GB or more"]]} /> : null}
              <Select label="Free storage" value={saved.disk} onChange={(disk) => update({ disk })} options={[["", "Not sure"], ["10", "10 GB"], ["20", "20 GB"], ["50", "50 GB"], ["100", "100 GB or more"]]} />
            </div>
            <details className="ai-fix">
              <summary>How do I find these?</summary>
              {saved.os === "mac" ? (
                <p className="cos-muted">Open the Apple menu, then “About This Mac”. It shows your chip and memory. Free storage is under System Settings, General, Storage.</p>
              ) : (
                <p className="cos-muted">Press Ctrl + Shift + Esc to open Task Manager, then the Performance tab. Memory shows your RAM; GPU shows your graphics card and its memory. Free storage is under Settings, System, Storage.</p>
              )}
            </details>
          </>
        ) : null}

        {step === 4 && app && result ? (
          <>
            <div className={`cos-notice ${result.pick ? "cos-notice-info" : "cos-notice-warning"}`} role="note">
              {result.pick ? null : <AlertTriangle size={16} aria-hidden="true" />}
              <span>{result.headline}</span>
            </div>
            {result.pick ? (
              <div className="cos-choices ai-models-choices" role="radiogroup" aria-label="Model">
                {result.all.map((item) => {
                  const chip = item.diskOk === false ? { tone: "warning", text: "Needs more storage" } : FIT_CHIP[item.fit];
                  const unavailable = item.fit === "no" || item.diskOk === false;
                  return (
                    <button key={item.model.key} type="button" role="radio" aria-checked={saved.model === item.model.key} aria-disabled={unavailable || undefined} className="cos-choice" onClick={() => !unavailable && update({ model: item.model.key })}>
                      <span className="ai-choice-head">
                        <strong>{item.model.name}</strong>
                        {item.model.key === result.pick?.model.key ? <span className="cos-chip cos-chip-info cos-chip-plain">Recommended</span> : null}
                      </span>
                      <span>{item.model.summary}</span>
                      <span className="ai-choice-meta">
                        <span className={`cos-chip ${chip.tone === "plain" ? "cos-chip-plain" : `cos-chip-${chip.tone}`}`}>{chip.text}</span>
                        <span>{sizeLabel(item.model, app)} download</span>
                      </span>
                      <span className="cos-muted">{item.reason}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p>
                <Link to="/settings#ai-connections" className="cos-btn cos-btn-primary">Use a cloud AI instead</Link>
              </p>
            )}
            <details className="ai-fix">
              <summary>About these models</summary>
              <p className="cos-muted">
                Sizes and names were checked on {CATALOG_VERIFIED_ON} against {app === "ollama" ? "Ollama’s library" : "LM Studio’s catalog"} and each maker’s model page. All four are licensed Apache-2.0, which allows personal use. Memory needs are a rule of thumb: about the download size plus 2 GB of working space.
              </p>
              <ul className="ai-source-list">
                {CATALOG.map((m) => (
                  <li key={m.key}>
                    {m.name} by {m.maker}: <a href={m.licenseUrl} target="_blank" rel="noopener noreferrer">licence and details</a> · <a href={m.ollamaUrl} target="_blank" rel="noopener noreferrer">Ollama page</a> · {m.contextK}K context
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : null}

        {step === 5 && app && chosen ? (
          <>
            <div className="cos-notice cos-notice-info" role="note">
              <span>CareerOS never installs anything or runs commands for you. You do these steps yourself, then come back.</span>
            </div>
            <ol className="ai-install-steps">
              <li>
                <div>
                  <strong>Get {app === "ollama" ? "Ollama" : "LM Studio"}</strong>
                  <p className="cos-muted">Download it from the official site and run the installer.</p>
                  <a className="cos-btn" href={app === "ollama" ? SOURCES.ollamaDownload : SOURCES.lmStudioHome} target="_blank" rel="noopener noreferrer">
                    {app === "ollama" ? "Open Ollama’s download page" : "Open the LM Studio website"} <ExternalLink size={14} aria-hidden="true" />
                  </a>
                  {app === "ollama" ? (
                    <details className="ai-fix">
                      <summary>Prefer the terminal?</summary>
                      <p className="cos-muted">Ollama also offers an install command. It downloads and runs a script from ollama.com, so the installer above is the more cautious route.</p>
                      <div className="cos-code">
                        <code>{saved.os === "mac" ? "curl -fsSL https://ollama.com/install.sh | sh" : "irm https://ollama.com/install.ps1 | iex"}</code>
                        <CopyButton text={saved.os === "mac" ? "curl -fsSL https://ollama.com/install.sh | sh" : "irm https://ollama.com/install.ps1 | iex"} label="Copy install command" />
                      </div>
                    </details>
                  ) : null}
                </div>
                <label className="cos-check"><input type="checkbox" checked={saved.done.get} onChange={(e) => update({ done: { ...saved.done, get: e.target.checked } })} /> Done</label>
              </li>
              <li>
                <div>
                  <strong>Open {app === "ollama" ? "Ollama" : "LM Studio"}</strong>
                  <p className="cos-muted">{app === "ollama" ? "Start it from your Start menu or Applications. It runs in the background; look for it in your taskbar or menu bar." : "Start it from your Start menu or Applications."}</p>
                </div>
                <label className="cos-check"><input type="checkbox" checked={saved.done.open} onChange={(e) => update({ done: { ...saved.done, open: e.target.checked } })} /> Done</label>
              </li>
              <li>
                <div>
                  <strong>Download {chosen.name}</strong>
                  {app === "ollama" ? (
                    <>
                      <p className="cos-muted">Open {saved.os === "mac" ? "Terminal" : "PowerShell"}, paste this, and press Enter. It’s a {sizeLabel(chosen, app)} download. You’ll see a progress bar, then “success”.</p>
                      <div className="cos-code">
                        <code>{`ollama pull ${modelId(chosen, app)}`}</code>
                        <CopyButton text={`ollama pull ${modelId(chosen, app)}`} label="Copy download command" />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="cos-muted">
                        Press {saved.os === "mac" ? "⌘ + 2" : "Ctrl + 2"} to open the Discover tab, search for the name below, and press Download. It’s about {sizeLabel(chosen, app)}. If you see several options, choose a 4-bit one or higher. <a href={SOURCES.lmStudioDownloadModel} target="_blank" rel="noopener noreferrer">LM Studio’s guide</a>.
                      </p>
                      <div className="cos-code">
                        <code>{modelId(chosen, app)}</code>
                        <CopyButton text={modelId(chosen, app)} label="Copy model name" />
                      </div>
                    </>
                  )}
                </div>
                <label className="cos-check"><input type="checkbox" checked={saved.done.model} onChange={(e) => update({ done: { ...saved.done, model: e.target.checked } })} /> Done</label>
              </li>
              {app === "lmstudio" ? (
                <li>
                  <div>
                    <strong>Start the server</strong>
                    <p className="cos-muted">In LM Studio, open the Developer tab and switch on “Start server”. This lets CareerOS talk to your model.</p>
                  </div>
                  <label className="cos-check"><input type="checkbox" checked={saved.done.server} onChange={(e) => update({ done: { ...saved.done, server: e.target.checked } })} /> Done</label>
                </li>
              ) : null}
            </ol>
            <details className="ai-fix">
              <summary>Something went wrong?</summary>
              <ul className="ai-help-list">
                <li>The download is slow or stops: the file is several gigabytes. Keep the computer awake and online, then run the step again; it picks up where it left off.</li>
                <li>{saved.os === "mac" ? "“command not found” after installing: quit and reopen Terminal." : "“ollama is not recognized” after installing: close PowerShell and open it again."}</li>
                <li>Not enough space: free up storage, or go back and choose a smaller model.</li>
              </ul>
            </details>
          </>
        ) : null}

        {step === 6 ? (
          <>
            <dl className="ai-summary">
              <div><dt>Computer</dt><dd>{saved.os === "mac" ? "macOS" : "Windows"}</dd></div>
              <div><dt>App</dt><dd>{app === "ollama" ? "Ollama" : app === "lmstudio" ? "LM Studio" : "Not chosen"}</dd></div>
              <div><dt>Model</dt><dd>{chosen && app ? `${chosen.name} (${modelId(chosen, app)})` : "Not chosen"}</dd></div>
              {chosenFit ? <div><dt>Expected</dt><dd>{FIT_CHIP[chosenFit.fit].text}</dd></div> : null}
            </dl>
            <p>Next, CareerOS will ask before it checks this computer, then show the models it finds and send one real test message.</p>
            <details className="ai-fix">
              <summary>If it can’t find your AI</summary>
              <SiteAccessHelp origin={origin} apps={app ? [app] : ["ollama", "lmstudio"]} />
            </details>
          </>
        ) : null}
      </div>

      <div className="cos-dialog-foot">
        <div className="ai-foot-left">
          <button type="button" className="cos-btn" onClick={() => (step === 1 ? onExit() : go(step - 1))}>
            <ArrowLeft size={15} aria-hidden="true" /> {step === 1 ? "Back to connect" : "Back"}
          </button>
          <button type="button" className="cos-btn cos-btn-quiet" onClick={() => { clearWizard(); setSaved(fresh()); }} aria-label="Start the setup over">
            <RotateCcw size={14} aria-hidden="true" /> Start over
          </button>
        </div>
        <div className="ai-foot-right">
          {step < 6 ? (
            <button type="button" className="cos-btn cos-btn-primary" disabled={!canNext} onClick={() => go(step + 1)}>
              Continue <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="cos-btn cos-btn-primary" onClick={() => onConnect(app && chosen ? { app, modelId: modelId(chosen, app) } : null)}>
              Check for my AI
            </button>
          )}
        </div>
      </div>
    </>
  );
}
