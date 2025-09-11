import { useEffect, useMemo, useState } from "react";
import { useMediaRecorder } from "../hooks/useMediaRecorder";

type QA = { q: string; a?: string; startedAt?: number; endedAt?: number; recordingId?: string };

const DEFAULT_BANK: string[] = [
  "Tell me about yourself.",
  "Describe a challenging project and your impact.",
  "What is your greatest strength?",
  "Tell me about a time you disagreed with a coworker.",
  "Why do you want this role?",
];

export default function InterviewSim() {
  const [bank, setBank] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("interviewSim:bank") || "[]"); } catch { return []; }
  });
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
    try { localStorage.setItem("interviewSim:autoRecord", autoRecord ? "1" : "0"); } catch {}
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
    if (autoRecord) await rec.stop(`Q${idx+1}`);
  };
  const next = () => setIdx((i) => Math.min(items.length - 1, i + 1));
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  const summary = useMemo(() => {
    const answered = items.filter((i) => i.endedAt);
    const totalSec = answered.reduce((s, i) => s + ((i.endedAt! - (i.startedAt || i.endedAt!)) / 1000), 0);
    return { count: answered.length, totalSec: Math.round(totalSec) };
  }, [items]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Mock Interview</h1>
      <p className="text-gray-600">Practice answers with a timer and optional audio recording. Progress is local to your browser.</p>

      <div className="p-4 rounded border border-gray-200 bg-white/70 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="font-medium">Question {idx + 1} of {items.length}</div>
          <div className="text-sm text-gray-600">Timer: {timer}s</div>
        </div>
        <div className="mt-2 text-lg">{current.q}</div>
        <textarea className="mt-3 w-full h-32 p-2 rounded border border-gray-200" placeholder="Notes / key points (optional)" value={current.a || ""} onChange={(e) => { const copy=[...items]; copy[idx] = { ...copy[idx], a: e.target.value }; setItems(copy); }} />
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1 rounded border" onClick={prev} disabled={idx===0}>Prev</button>
          <button className="px-3 py-1 rounded border" onClick={start}>Start</button>
          <button className="px-3 py-1 rounded border" onClick={stop}>Stop</button>
          <button className="px-3 py-1 rounded border" onClick={next} disabled={idx===items.length-1}>Next</button>
          <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} /> Auto-record</label>
        </div>
      </div>

      <div className="p-4 rounded border border-gray-200 bg-white/70 backdrop-blur">
        <div className="font-medium mb-2">Session Summary</div>
        <div className="text-sm text-gray-600">Answered: {summary.count}/{items.length} • Total time: {summary.totalSec}s</div>
      </div>
    </div>
  );
}

