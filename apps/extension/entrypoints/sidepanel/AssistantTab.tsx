import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Banner, Card, type Tone } from "./ui";
import { useModel } from "./lib/context";
import VisualCard from "./VisualCard";
import { aiAvailability } from "./lib/ai";
import {
  ASSISTANT_ACTIONS,
  CHAT_SCHEMA,
  CHAT_SUGGESTIONS,
  buildAssistantRequest,
  buildChatRequest,
  chatFor,
  runAssistant,
  validateChatReply,
  type AssistantAction,
  type AssistantItem,
  type AssistantRequest,
  type AssistantResult,
  type ChatAnswer,
  type ChatTurn,
  type SharedItem,
} from "../../src/ai/jobAssistant";

const CLASS_TONE: Record<AssistantItem["classification"], Tone> = { matched: "success", partial: "warning", missing: "danger", uncertain: "info" };
const CLASS_LABEL: Record<AssistantItem["classification"], string> = { matched: "Matched", partial: "Partial", missing: "Missing", uncertain: "Uncertain" };
const CONF_LABEL = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;

const isAbort = (e: unknown) => e instanceof Error && (e.name === "AbortError" || /abort|cancel/i.test(e.message));
const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/** Shown before anything is sent: where it goes and exactly what it contains. */
function Disclosure({ where, shared, prompt }: { where: string; shared: SharedItem[]; prompt?: string }) {
  return (
    <div className="disclosure" data-testid="share-preview">
      <p className="meta">Sent to <strong>{where}</strong>, which runs on this device. Nothing goes to the cloud.</p>
      <ul className="shared-list">
        {shared.map((s) => (
          <li key={s.label}>
            <strong>{s.label}</strong> · {s.detail}
            {s.lines?.length ? (
              <details>
                <summary>Show the {s.lines.length} line{s.lines.length === 1 ? "" : "s"}</summary>
                <ul className="evidence-lines">{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      {prompt ? (
        <details>
          <summary>Show the exact text sent</summary>
          <pre className="prompt-text" data-testid="exact-prompt">{prompt}</pre>
        </details>
      ) : null}
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

function ResultItem({ item, approved, onApprove, action }: { item: AssistantItem; approved: boolean; onApprove: (text: string) => void; action: AssistantAction }) {
  const [text, setText] = useState(item.suggestion);
  const [editing, setEditing] = useState(false);
  const draftable = Boolean(item.suggestion) && (action === "improve" || action === "tailor" || action === "answers");
  return (
    <li className="assist-item" data-testid="assist-item">
      <div className="assist-item-head">
        <span className="req-term">{item.requirement}</span>
        <Badge tone={CLASS_TONE[item.classification]}>{CLASS_LABEL[item.classification]}</Badge>
        <span className="meta">{CONF_LABEL[item.confidence]}</span>
      </div>
      {item.explanation ? <p>{item.explanation}</p> : null}
      {item.evidence ? <blockquote className="meta" data-testid="assist-evidence">From your résumé: {item.evidence}</blockquote> : null}
      {item.suggestion && !draftable ? <p><strong>Suggestion:</strong> {item.suggestion}</p> : null}
      {draftable ? (
        <div className="draft">
          <label className="meta" htmlFor={`draft-${item.requirement}`}>Suggested wording (a draft for you to review)</label>
          {editing ? (
            <textarea id={`draft-${item.requirement}`} className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          ) : (
            <p className="draft-text" id={`draft-${item.requirement}`}>{text}</p>
          )}
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing((v) => !v)}>{editing ? "Done editing" : "Edit"}</button>
            <CopyButton text={text} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onApprove(text)} disabled={approved}>{approved ? "Approved" : "Approve draft"}</button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default function AssistantTab() {
  const m = useModel();
  const { state, page } = m;
  const availability = useMemo(() => aiAvailability(state?.aiConnection ?? null), [state?.aiConnection]);
  const ready = availability.kind === "ready" ? availability : null;
  const job = m.readable ? (page?.job ?? null) : null;
  const intel = m.readable ? page?.intelligence : null;
  const profile = state?.sharedProfile ?? null;
  const where = ready ? `${ready.snapshot.providerLabel} · ${ready.snapshot.model} (${ready.host})` : "";
  const pageKey = page?.url ?? "";

  const [pending, setPending] = useState<AssistantRequest | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const abort = useRef<AbortController | null>(null);
  const resultHead = useRef<HTMLHeadingElement>(null);

  // A different page or model means earlier results and consent no longer apply.
  useEffect(() => {
    abort.current?.abort();
    setPending(null);
    setResult(null);
    setError("");
    setRunning(null);
    setConsented(false);
    setTurns([]);
    setApproved({});
  }, [pageKey, ready?.snapshot.model, ready?.snapshot.baseUrl]);

  const start = (action: AssistantAction) => {
    setError("");
    setResult(null);
    try {
      setPending(buildAssistantRequest({ action, job, intelligence: intel, profile, fields: page?.fields }));
    } catch (e) {
      setPending(null);
      setError(message(e));
    }
  };

  const send = async () => {
    if (!pending || !ready) return;
    const request = pending;
    const controller = new AbortController();
    abort.current = controller;
    setPending(null);
    setRunning(ASSISTANT_ACTIONS.find((a) => a.id === request.action)!.label);
    setError("");
    try {
      const out = await runAssistant(request, chatFor(ready, request.task), controller.signal);
      if (controller.signal.aborted) return;
      setResult(out);
      window.setTimeout(() => resultHead.current?.focus(), 0);
    } catch (e) {
      if (isAbort(e) || controller.signal.aborted) setError("Stopped. Nothing was kept.");
      else setError(message(e));
    } finally {
      if (abort.current === controller) abort.current = null;
      setRunning(null);
    }
  };

  const stop = () => abort.current?.abort();

  // A shortcut from the Page tab opens the same review step, so nothing is sent without the person seeing it.
  const requested = m.ui.pendingAction;
  useEffect(() => {
    if (!requested) return;
    if (ready && job?.description) start(requested);
    m.updateUi({ pendingAction: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, Boolean(ready), Boolean(job?.description)]);

  /* ---- chat ---- */
  const [consented, setConsented] = useState(false);
  const [turns, setTurns] = useState<Array<ChatTurn & { shared?: SharedItem[]; evidence?: string[]; warnings?: string[] }>>([]);
  const [draft, setDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatAbort = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    if (!ready || chatBusy) return;
    setChatError("");
    let request;
    try {
      request = buildChatRequest({ question, history: turns, job, intelligence: intel, profile });
    } catch (e) {
      setChatError(message(e));
      return;
    }
    const controller = new AbortController();
    chatAbort.current = controller;
    setTurns((t) => [...t, { role: "user", text: question }]);
    setDraft("");
    setChatBusy(true);
    try {
      const reply = await chatFor(ready, "job_analysis")(request.messages, { format: CHAT_SCHEMA, signal: controller.signal, timeoutMs: 180_000 });
      const answer: ChatAnswer = validateChatReply(reply.text, request);
      setTurns((t) => [...t, { role: "assistant", text: answer.answer, shared: request.shared, evidence: answer.evidence, warnings: answer.warnings }]);
    } catch (e) {
      setChatError(isAbort(e) || controller.signal.aborted ? "Stopped." : message(e));
    } finally {
      if (chatAbort.current === controller) chatAbort.current = null;
      setChatBusy(false);
      window.setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }), 0);
    }
  };

  const approve = (key: string, text: string) => {
    setApproved((a) => ({ ...a, [key]: true }));
    m.updateUi((u) => ({ approvedDrafts: [{ url: pageKey, text, approvedAt: new Date().toISOString() }, ...(u.approvedDrafts ?? [])].slice(0, 50) }));
  };

  /* ---- render ---- */
  if (!m.readable || !job?.description) {
    return (
      <div className="stack" data-testid="assistant-tab">
        <Card id="assistant" title="Job assistant">
          <p className="muted" data-testid="assistant-no-job">Open a job posting and CareerOS can explain it, compare it with your résumé, and help you answer questions. It needs the job description on the page to do that.</p>
        </Card>
        <VisualCard />
      </div>
    );
  }

  return (
    <div className="stack" data-testid="assistant-tab">
      <Card
        id="assistant"
        title="Job assistant"
        badge={ready ? <Badge tone="success">On this device</Badge> : <Badge tone="warning">Not connected</Badge>}
      >
        {ready ? (
          <p className="meta" data-testid="assistant-model">Using {ready.snapshot.providerLabel} · {ready.snapshot.model}. It only sees what you review and approve below.</p>
        ) : (
          <div data-testid="assistant-unavailable">
            <p>{availability.kind === "ready" ? "" : availability.reason}</p>
            <button type="button" className="btn btn-secondary" onClick={() => m.updateUi({ tab: "ai" })}>Set up a local model</button>
          </div>
        )}
        <div className="action-grid" role="group" aria-label="Job assistant actions">
          {ASSISTANT_ACTIONS.map((a) => (
            <button key={a.id} type="button" className="action-btn" data-testid={`assist-${a.id}`} onClick={() => start(a.id)} disabled={!ready || Boolean(running)}>
              <span className="action-label">{a.label}</span>
              <span className="meta">{a.hint}</span>
            </button>
          ))}
        </div>

        {pending && ready ? (
          <div className="review-box" role="group" aria-label="Review before sending" data-testid="assist-review">
            <h3 className="sub-title">Review before sending</h3>
            <Disclosure where={where} shared={pending.shared} prompt={pending.prompt} />
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => void send()} data-testid="assist-send">Send to {ready.snapshot.model}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        ) : null}

        {running ? (
          <div className="running" role="status" data-testid="assist-running">
            <span className="spinner" aria-hidden />
            <span>{running}… the model is working on this device.</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={stop} data-testid="assist-stop">Stop</button>
          </div>
        ) : null}

        <div aria-live="polite">{error ? <Banner tone={error.startsWith("Stopped") ? "info" : "danger"} testId="assist-error">{error}</Banner> : null}</div>

        {result ? (
          <section className="assist-result" aria-labelledby="assist-result-h" data-testid="assist-result">
            <h3 id="assist-result-h" className="sub-title" tabIndex={-1} ref={resultHead}>{ASSISTANT_ACTIONS.find((a) => a.id === result.action)!.label}</h3>
            {result.summary ? <p data-testid="assist-summary">{result.summary}</p> : null}
            {result.warnings.map((w) => <Banner key={w} tone="warning">{w}</Banner>)}
            <ul className="assist-items">
              {result.items.map((item, i) => (
                <ResultItem key={`${item.requirement}-${i}`} item={item} action={result.action} approved={Boolean(approved[`${item.requirement}-${i}`])} onApprove={(text) => approve(`${item.requirement}-${i}`, text)} />
              ))}
            </ul>
            <p className="meta">Suggestions only. CareerOS never changes your résumé, fills a form or submits anything because of an AI reply.</p>
          </section>
        ) : null}
      </Card>

      <Card id="ask" title="Ask CareerOS about this job">
        {!ready ? (
          <p className="muted">Connect a local model to ask questions about this job.</p>
        ) : !consented ? (
          <div data-testid="chat-consent">
            <p>Each question sends this job’s description to <strong>{ready.snapshot.model}</strong> on this device. Questions about you also send the few résumé lines that relate to the job. You can see exactly what was sent under every answer.</p>
            <button type="button" className="btn btn-primary" onClick={() => setConsented(true)} data-testid="chat-consent-accept">Start asking</button>
          </div>
        ) : (
          <>
            <div className="chips" role="group" aria-label="Suggested questions">
              {CHAT_SUGGESTIONS.map((q) => (
                <button key={q} type="button" className="chip-btn" disabled={chatBusy} onClick={() => void ask(q)}>{q}</button>
              ))}
            </div>
            <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation" data-testid="chat-log">
              {turns.map((t, i) => (
                <div key={i} className={`bubble bubble-${t.role}`} data-testid={`chat-${t.role}`}>
                  <p className="bubble-text">{t.text}</p>
                  {t.role === "assistant" ? (
                    <>
                      {t.evidence?.length ? <blockquote className="meta">From your résumé: {t.evidence.join(" · ")}</blockquote> : null}
                      {t.warnings?.map((w) => <p key={w} className="meta warn-text">{w}</p>)}
                      <div className="row">
                        <CopyButton text={t.text} />
                      </div>
                      {t.shared ? (
                        <details>
                          <summary className="meta">What was sent</summary>
                          <Disclosure where={where} shared={t.shared} />
                        </details>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ))}
              {chatBusy ? (
                <div className="bubble bubble-assistant" role="status" data-testid="chat-thinking">
                  <span className="spinner" aria-hidden /> Thinking…
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => chatAbort.current?.abort()}>Stop</button>
                </div>
              ) : null}
            </div>
            <div aria-live="polite">{chatError ? <Banner tone={chatError === "Stopped." ? "info" : "danger"} testId="chat-error">{chatError}</Banner> : null}</div>
            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) void ask(draft.trim());
              }}
            >
              <label htmlFor="chat-input" className="sr-only">Ask a question about this job</label>
              <textarea
                id="chat-input"
                className="input"
                rows={2}
                value={draft}
                placeholder="Ask about this job…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (draft.trim()) void ask(draft.trim());
                  }
                }}
                data-testid="chat-input"
              />
              <button type="submit" className="btn btn-primary" disabled={chatBusy || !draft.trim()} data-testid="chat-send">Ask</button>
            </form>
          </>
        )}
      </Card>
      <VisualCard />
    </div>
  );
}
