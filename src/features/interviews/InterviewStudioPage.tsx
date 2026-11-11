import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText, Trash2 } from "lucide-react";
import { setLocal } from "../../hooks/useLocal";
import { deleteSessionRecordings, purgeExpired } from "./mediaStore";
import { CONFIG_KEY, MODE_LABELS, TYPE_LABELS, loadConfig, loadSessions, newId, saveSessions, type Answer, type Session } from "./model";
import { pickQuestions } from "./questions";
import SessionReport from "./SessionReport";
import SessionRoom from "./SessionRoom";
import SetupPanel from "./SetupPanel";
import { detectTranscription, type TranscriptionSupport } from "./speech";
import "./interview-studio.css";

type View = { kind: "setup" } | { kind: "session"; id: string } | { kind: "report"; id: string };

export default function InterviewStudioPage() {
  const [config, setConfig] = useState(loadConfig);
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [view, setView] = useState<View>({ kind: "setup" });
  const [transcription, setTranscription] = useState<TranscriptionSupport | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => setLocal(CONFIG_KEY, config), [config]);
  useEffect(() => saveSessions(sessions), [sessions]);
  useEffect(() => {
    void detectTranscription().then(setTranscription);
    void purgeExpired()
      .then((removed) => removed && setStatus(`${removed} expired recording${removed === 1 ? " was" : "s were"} deleted.`))
      .catch(() => undefined);
  }, []);

  const active = view.kind !== "setup" ? sessions.find((session) => session.id === view.id) : undefined;
  const questions = useMemo(
    () => (active ? pickQuestions(active.config.type, active.config.difficulty, active.config.level, active.config.questionCount, active.id, active.config.jobDescription, active.config.jobTitle) : []),
    [active?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const updateSession = (id: string, change: (session: Session) => Session) => setSessions((current) => current.map((session) => (session.id === id ? change(session) : session)));

  const start = () => {
    const session: Session = { id: newId(), createdAt: new Date().toISOString(), config, answers: [] };
    setSessions((current) => [session, ...current]);
    setView({ kind: "session", id: session.id });
    setStatus("");
  };

  const saveAnswer = (answer: Answer) => {
    if (!active) return;
    updateSession(active.id, (session) => {
      const existing = session.answers.find((item) => item.questionId === answer.questionId);
      if (!existing) return { ...session, answers: [...session.answers, answer] };
      const merged: Answer = {
        ...existing,
        ...answer,
        id: existing.id,
        audio: answer.audio ?? existing.audio,
        presentation: answer.presentation ?? existing.presentation,
        mediaId: answer.mediaId ?? existing.mediaId,
        mediaKind: answer.mediaKind ?? existing.mediaKind,
        durationSec: answer.audio ? answer.durationSec : existing.durationSec || answer.durationSec,
      };
      return { ...session, answers: session.answers.map((item) => (item.id === existing.id ? merged : item)) };
    });
  };

  const removeSession = async (id: string) => {
    await deleteSessionRecordings(id).catch(() => undefined);
    setSessions((current) => current.filter((session) => session.id !== id));
    setView({ kind: "setup" });
    setStatus("Session deleted.");
  };

  if (view.kind === "session" && active)
    return (
      <div className="career-feature iv-page">
        <SessionRoom
          session={active}
          questions={questions}
          transcription={transcription}
          onSaveAnswer={saveAnswer}
          onEnd={() => {
            updateSession(active.id, (session) => ({ ...session, endedAt: new Date().toISOString() }));
            setView({ kind: "report", id: active.id });
          }}
        />
      </div>
    );

  if (view.kind === "report" && active)
    return (
      <div className="career-feature iv-page">
        <SessionReport session={active} onChange={(session) => updateSession(session.id, () => session)} onDelete={() => void removeSession(active.id)} onBack={() => setView({ kind: "setup" })} />
      </div>
    );

  return (
    <div className="career-feature iv-page">
      <div className="career-feature-header">
        <div>
          <span className="career-overline">PRACTICE WITH PURPOSE</span>
          <h1>Interview Studio</h1>
          <p>Practice aloud or in writing, optionally on camera, and review feedback tied to what you actually said.</p>
        </div>
        <Link className="career-secondary-button" to="/career-tools/interview-sim">
          Open original simulator
        </Link>
      </div>
      <p className="rs-status" role="status" aria-live="polite">{status}</p>
      <div className="iv-layout">
        <SetupPanel config={config} onChange={setConfig} onStart={start} transcription={transcription} />
        <aside className="career-panel iv-history" aria-labelledby="iv-history-title">
          <h2 id="iv-history-title">Practice history</h2>
          {sessions.length ? (
            <ul>
              {sessions.map((session) => (
                <li key={session.id}>
                  <div>
                    <strong>{TYPE_LABELS[session.config.type]}</strong>
                    <span>
                      {new Date(session.createdAt).toLocaleDateString()} · {MODE_LABELS[session.config.mode]} · {session.answers.length} answer{session.answers.length === 1 ? "" : "s"}
                    </span>
                    {session.answers[0]?.text ? <p>{session.answers[0].text.slice(0, 120)}</p> : null}
                  </div>
                  <div className="iv-row">
                    <button type="button" className="career-secondary-button" onClick={() => setView({ kind: "report", id: session.id })}>
                      <FileText size={14} /> Open report
                    </button>
                    <button
                      type="button"
                      className="career-danger-button"
                      aria-label={`Delete ${TYPE_LABELS[session.config.type]} session from ${new Date(session.createdAt).toLocaleDateString()}`}
                      onClick={() => {
                        if (window.confirm("Delete this session, its transcripts, and any saved recordings?")) void removeSession(session.id);
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="career-muted">No sessions yet. Sessions are saved in this browser when you start one.</p>
          )}
          <div className="iv-data">
            <h3>Your data</h3>
            <p className="career-muted">Sessions and transcripts are stored in this browser. Recordings exist only if you turned on saving, and expire automatically.</p>
            <div className="iv-row">
              <button type="button" className="career-secondary-button" disabled={!sessions.length} onClick={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = "interview-studio-data.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}>
                <Download size={14} /> Export all
              </button>
              <button
                type="button"
                className="career-danger-button"
                disabled={!sessions.length}
                onClick={async () => {
                  if (!window.confirm("Delete all interview sessions, transcripts, and saved recordings? This cannot be undone.")) return;
                  await Promise.all(sessions.map((session) => deleteSessionRecordings(session.id).catch(() => undefined)));
                  setSessions([]);
                  setStatus("All interview data deleted.");
                }}
              >
                <Trash2 size={14} /> Delete all
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
