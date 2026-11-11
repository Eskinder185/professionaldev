import { useEffect, useMemo, useState } from "react";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import PageHeader from "../components/ui/PageHeader";

type QA = { q: string; a?: string; startedAt?: number; endedAt?: number; recordingId?: string };

const DEFAULT_BANK: string[] = [
  "Tell me about yourself.",
  "Describe a challenging project and your impact.",
  "What is your greatest strength?",
  "Tell me about a time you disagreed with a coworker.",
  "Why do you want this role?",
];

export default function InterviewSim() {
  const [items, setItems] = useState<QA[]>(() => DEFAULT_BANK.map((q) => ({ q })));
  const [idx, setIdx] = useState(0);
  const [timer, setTimer] = useState(0);
  const [autoRecord, setAutoRecord] = useState<boolean>(() => localStorage.getItem("interviewSim:autoRecord") === "1");
  const rec = useMediaRecorder({ audio: true });

  const current = items[idx];

  useEffect(() => {
    const t = window.setInterval(() => {
      const it = items[idx];
      if (it?.startedAt && !it?.endedAt) setTimer(Math.floor((Date.now() - it.startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(t);
  }, [idx, items]);

  useEffect(() => {
    try {
      localStorage.setItem("interviewSim:autoRecord", autoRecord ? "1" : "0");
    } catch {
      // Recording practice still works when preferences cannot be persisted.
    }
  }, [autoRecord]);

  const start = async () => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], startedAt: Date.now(), endedAt: undefined };
    setItems(copy);
    if (autoRecord) await rec.start();
  };
  const stop = async () => {
    const copy = [...items];
    const it = copy[idx];
    copy[idx] = { ...it, endedAt: Date.now() };
    setItems(copy);
    if (autoRecord) await rec.stop();
  };
  const next = () => setIdx((i) => Math.min(items.length - 1, i + 1));
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  const summary = useMemo(() => {
    const answered = items.filter((i) => i.endedAt);
    const totalSec = answered.reduce((s, i) => s + ((i.endedAt! - (i.startedAt || i.endedAt!)) / 1000), 0);
    return { count: answered.length, totalSec: Math.round(totalSec) };
  }, [items]);

  return (
    <div className="mx-auto max-w-4xl space-y-0">
      <PageHeader
        eyebrow="Career Tools"
        title="Mock Interview"
        sub="Practice answers with a timer and optional audio recording. Progress is local to your browser."
      />

      <section className="border-t border-border/70 pt-8 sm:pt-10">
        <div className="flex items-center justify-between">
          <div className="font-medium text-ink dark:text-white">
            Question {idx + 1} of {items.length}
          </div>
          <div className="text-sm text-ink-muted">Timer: {timer}s</div>
        </div>
        <p className="mt-3 text-lg text-ink dark:text-white">{current.q}</p>
        <textarea
          className="textarea mt-4 min-h-32 w-full"
          placeholder="Notes / key points (optional)"
          value={current.a || ""}
          onChange={(e) => {
            const copy = [...items];
            copy[idx] = { ...copy[idx], a: e.target.value };
            setItems(copy);
          }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn surface-muted min-h-10 px-4" onClick={prev} disabled={idx === 0}>
            Prev
          </button>
          <button type="button" className={`btn min-h-10 px-4 ${rec.isRecording ? "btn-danger" : "btn-primary"}`} onClick={rec.isRecording ? stop : start}>
            {rec.isRecording ? "Stop recording" : "Start"}
          </button>
          {rec.isRecording && (
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={stop}>
              Stop
            </button>
          )}
          <button type="button" className="btn surface-muted min-h-10 px-4" onClick={next} disabled={idx === items.length - 1}>
            Next
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
            <input type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} /> Auto-record microphone
          </label>
        </div>

        {rec.isRecording && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400" role="status">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span>Recording audio… {Math.round(rec.elapsedMs / 1000)}s</span>
          </div>
        )}

        {rec.error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300" role="alert">
            {rec.error}
          </div>
        )}

        {rec.url && !rec.isRecording && (
          <div className="mt-4 rounded-xl border border-border/80 bg-surface-muted/40 p-4">
            <div className="text-sm font-medium text-ink dark:text-white">Review your recording:</div>
            <audio controls src={rec.url} className="mt-2 w-full h-10" />
          </div>
        )}
      </section>

      <section className="border-t border-border/70 pt-8 sm:pt-10 pb-4">
        <h2 className="font-medium text-ink dark:text-white">Session summary</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Answered: {summary.count}/{items.length} · Total time: {summary.totalSec}s
        </p>
      </section>
    </div>
  );
}
