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
    } catch {}
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
    if (autoRecord) await rec.stop(`Q${idx + 1}`);
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn surface-muted min-h-10 px-4" onClick={prev} disabled={idx === 0}>
            Prev
          </button>
          <button type="button" className="btn surface-muted min-h-10 px-4" onClick={start}>
            Start
          </button>
          <button type="button" className="btn surface-muted min-h-10 px-4" onClick={stop}>
            Stop
          </button>
          <button type="button" className="btn surface-muted min-h-10 px-4" onClick={next} disabled={idx === items.length - 1}>
            Next
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} /> Auto-record
          </label>
        </div>
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
