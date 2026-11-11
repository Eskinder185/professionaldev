import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cloud, Cpu, Lock, PiggyBank, Settings, ShieldCheck, Sparkles, UserX } from "lucide-react";
import { useAIConnection } from "./AIConnectionProvider";
import ConnectSheet, { type SheetView } from "./ConnectSheet";
import { describeHomeAI } from "./connectionView";
import { validateEndpoint } from "./endpoint";
import "./ai-home.css";

const REASONS = [
  { icon: Lock, title: "Private", detail: "Runs on your computer. Your résumé stays here." },
  { icon: PiggyBank, title: "Free to run", detail: "No subscription for local AI." },
  { icon: UserX, title: "No account", detail: "Nothing to sign up for." },
];

/**
 * The AI connection, front and centre on the home screen.
 * Not connected: a short invitation with one obvious action.
 * Connected: a compact status strip whose wording is only as strong as what has been verified.
 */
export default function HomeAIPanel() {
  const { state, dispatch, testConnection, runInferenceTest } = useAIConnection();
  const [sheet, setSheet] = useState<SheetView | null>(null);
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const view = describeHomeAI(state);

  const test = async () => {
    setTesting(true);
    setNote(null);
    // Pressing Test next to a visible address is the person's go-ahead to contact exactly that address.
    const endpoint = validateEndpoint(state.baseUrl);
    if (endpoint.ok && endpoint.isLoopback) dispatch({ type: "consent", value: true });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const reached = await testConnection();
    const replied = reached ? await runInferenceTest() : false;
    setTesting(false);
    setNote(
      replied
        ? { tone: "success", text: `${view.model} replied. Your AI is ready.` }
        : { tone: "danger", text: `CareerOS couldn’t get a reply from ${view.providerLabel}. It may be closed or still loading the model. Open it, then press Test AI again.` },
    );
  };

  return (
    <>
      {view.configured ? (
        <section className="ai-home ai-strip" aria-label="Your AI connection" data-testid="home-ai-strip">
          <div className="ai-strip-id">
            <span className="ai-strip-icon" aria-hidden="true">{view.location === "Cloud" ? <Cloud size={18} /> : <Cpu size={18} />}</span>
            <div>
              <strong>{view.providerLabel} · {view.model}</strong>
              <span className="cos-muted">{view.location}</span>
            </div>
          </div>
          <span className={`cos-chip cos-chip-${view.chip.tone} ${view.chip.busy ? "cos-chip-busy" : ""}`} role="status" data-testid="home-ai-status">
            {view.chip.text}
          </span>
          <div className="ai-strip-actions">
            {view.ready ? (
              <Link to="/autoapply" className="cos-btn cos-btn-primary">
                Continue with Autopilot <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ) : (
              <button type="button" className="cos-btn cos-btn-primary" onClick={() => void test()} disabled={testing} data-loading={testing}>
                {testing ? <span className="cos-spinner" aria-hidden="true" /> : null} {testing ? "Testing…" : "Test AI"}
              </button>
            )}
            {view.ready ? (
              <button type="button" className="cos-btn" onClick={() => void test()} disabled={testing} data-loading={testing}>
                {testing ? "Testing…" : "Test AI"}
              </button>
            ) : null}
            <button type="button" className="cos-btn" onClick={() => setSheet("connect")}>Switch model</button>
            <Link to="/settings#ai-connections" className="cos-btn" aria-label="Open AI settings">
              <Settings size={15} aria-hidden="true" /> Settings
            </Link>
          </div>
          {note ? (
            <p className={`ai-strip-note ai-note-${note.tone}`} role="status" aria-live="polite">{note.text}</p>
          ) : null}
        </section>
      ) : (
        <section className="ai-home ai-hero" aria-labelledby="ai-home-title" data-testid="home-ai-hero">
          <div className="ai-hero-copy">
            <span className="cos-eyebrow">YOUR AI</span>
            <h2 id="ai-home-title">Your AI. Your career. Your control.</h2>
            <p>Connect your own AI to find jobs, tailor your résumé, prepare applications, and practise interviews.</p>
            <div className="ai-hero-actions">
              <button type="button" className="cos-btn cos-btn-primary cos-btn-lg" onClick={() => setSheet("connect")}>
                <Sparkles size={17} aria-hidden="true" /> Connect your AI
              </button>
              <button type="button" className="cos-btn cos-btn-quiet cos-btn-lg" onClick={() => setSheet("cloud")}>
                <Cloud size={16} aria-hidden="true" /> Use a cloud AI
              </button>
            </div>
            <ul className="ai-reasons">
              {REASONS.map(({ icon: Icon, title, detail }) => (
                <li key={title}>
                  <Icon size={16} aria-hidden="true" />
                  <span><strong>{title}.</strong> {detail}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ai-hero-art" aria-hidden="true">
            <span className="ai-orb"><ShieldCheck size={44} /></span>
          </div>
        </section>
      )}
      {sheet ? <ConnectSheet initialView={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}
