import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader";
import { BREAK_IDEAS } from "../../data/resources/breakIdeas";
// Inline SVG line chart to avoid external chart deps

type Settings = { focusMin: number; shortMin: number; longMin: number; cyclesBeforeLong: number; autoStartNext: boolean };
type HistoryItem = { date: string; mode: "Focus" | "Short" | "Long"; minutes: number };

export default function Productivity() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem("pd:resources:pomodoro:settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as Settings;
        }
      }
    } catch {}
    return { focusMin: 25, shortMin: 5, longMin: 15, cyclesBeforeLong: 4, autoStartNext: true };
  });
  const [mode, setMode] = useState<"Focus" | "Short" | "Long">("Focus");
  const [remaining, setRemaining] = useState(settings.focusMin * 60);
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>(() => { try { return JSON.parse(localStorage.getItem("pd:resources:pomodoro:history") || "[]"); } catch { return []; } });
  const [showBreak, setShowBreak] = useState<string | null>(null);
  const [ambient, setAmbient] = useState<"off" | "white" | "pink" | "brown">("off");
  const oscRef = useRef<AudioContext | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => { localStorage.setItem("pd:resources:pomodoro:settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem("pd:resources:pomodoro:history", JSON.stringify(history)); }, [history]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [running]);

  useEffect(() => {
    if (remaining !== 0) return;
    setRunning(false);
    chime();
    setHistory([{ date: new Date().toISOString(), mode, minutes: durationFor(mode, settings) }, ...history].slice(0, 50));
    if (mode === "Focus") setCycle((c) => c + 1);
    if (settings.autoStartNext) {
      const next = nextMode(mode, cycle + 1, settings);
      setMode(next);
      setRemaining(durationFor(next, settings) * 60);
      setRunning(true);
      if (next !== "Focus") setShowBreak(randomBreak());
    } else {
      setShowBreak(randomBreak());
    }
  }, [remaining]);

  useEffect(() => {
    setRemaining(durationFor(mode, settings) * 60);
  }, [mode, settings]);

  function durationFor(m: "Focus" | "Short" | "Long", s: Settings) { return m === "Focus" ? s.focusMin : m === "Short" ? s.shortMin : s.longMin; }
  function nextMode(m: "Focus" | "Short" | "Long", c: number, s: Settings) {
    if (m === "Focus") return c % s.cyclesBeforeLong === 0 ? "Long" : "Short";
    return "Focus";
  }
  function randomBreak() { return BREAK_IDEAS[Math.floor(Math.random() * BREAK_IDEAS.length)].label; }

  function chime() {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    o.start(); o.stop(ctx.currentTime + 1.05);
  }

  function toggleAmbient(kind: typeof ambient) {
    setAmbient(kind);
    try { oscRef.current?.close(); } catch {}
    if (kind === "off") return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type = kind === "white" ? "square" : kind === "pink" ? "sawtooth" : "triangle";
    o.frequency.value = kind === "white" ? 100 : kind === "pink" ? 60 : 40; g.gain.value = 0.02; o.start();
    (oscRef as any).current = ctx;
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const daily = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of history) {
      if (h.mode !== "Focus") continue;
      const d = new Date(h.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      map[key] = (map[key] || 0) + h.minutes;
    }
    return Object.entries(map).map(([d, m]) => ({ date: d, minutes: m }));
  }, [history]);
  const dailyTotals = useMemo(() => daily.map((d) => ({ day: d.date, minutes: d.minutes })), [daily]);

  return (
    <div className="space-y-8 pb-6">
      <PageHeader
        eyebrow="Grow"
        title="Time & Productivity"
        sub="Pomodoro cycles, optional ambient noise, and a simple focus history — stored locally. A standalone task-list app is planned; this page is your in-site focus hub."
      />

      <div className="border-b border-dashed border-black/[0.12] py-6 dark:border-white/[0.14] sm:py-8">
        <h2 className="text-sm font-semibold text-ink dark:text-white">Task tracker (coming soon)</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          The previous external task tracker link is retired. A dedicated checklist and habit view will ship here later. For now, use{" "}
          <Link to="/resources/trackers" className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]">
            Skill &amp; job trackers
          </Link>{" "}
          for structured logging, or stay on this page for timed focus sessions.
        </p>
      </div>

      <section className="border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <h2 className="text-title-sm text-ink dark:text-white">Timer settings</h2>
        <p className="mt-1 text-sm text-ink-muted">Durations and auto-advance apply to the next segment after you change them.</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block space-y-1.5 text-sm font-medium text-ink dark:text-white">
            Focus (min)
            <input
              type="number"
              className="input min-h-11"
              value={settings.focusMin}
              onChange={(e) => setSettings({ ...settings, focusMin: Number(e.target.value) || 25 })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-ink dark:text-white">
            Short break (min)
            <input
              type="number"
              className="input min-h-11"
              value={settings.shortMin}
              onChange={(e) => setSettings({ ...settings, shortMin: Number(e.target.value) || 5 })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-ink dark:text-white">
            Long break (min)
            <input
              type="number"
              className="input min-h-11"
              value={settings.longMin}
              onChange={(e) => setSettings({ ...settings, longMin: Number(e.target.value) || 15 })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-ink dark:text-white">
            Cycles before long
            <input
              type="number"
              className="input min-h-11"
              value={settings.cyclesBeforeLong}
              onChange={(e) => setSettings({ ...settings, cyclesBeforeLong: Number(e.target.value) || 4 })}
            />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 pt-6 text-sm font-medium text-ink dark:text-white lg:pt-8">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-black/20 text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] dark:border-white/25"
              checked={settings.autoStartNext}
              onChange={(e) => setSettings({ ...settings, autoStartNext: e.target.checked })}
            />
            Auto-start next phase
          </label>
        </div>
      </section>

      <section className="border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <p className="text-center text-caption font-medium uppercase tracking-wider text-ink-muted">Current mode</p>
        <p className="mt-1 text-center text-lg font-semibold text-ink dark:text-white">{mode}</p>
        <div className="mt-4 text-center font-mono text-4xl tabular-nums tracking-tight text-ink dark:text-white sm:text-5xl">
          {mm}:{ss}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {!running ? (
            <button type="button" className="btn btn-primary min-h-11 px-6" onClick={() => setRunning(true)}>
              Start
            </button>
          ) : (
            <button type="button" className="btn surface-muted min-h-11 px-6" onClick={() => setRunning(false)}>
              Pause
            </button>
          )}
          <button
            type="button"
            className="btn surface-muted min-h-11 px-5"
            onClick={() => {
              setRunning(false);
              setRemaining(durationFor(mode, settings) * 60);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn surface-muted min-h-11 px-5"
            onClick={() => {
              const n = nextMode(mode, cycle + 1, settings);
              setMode(n);
            }}
          >
            Skip phase
          </button>
        </div>
        {showBreak ? (
          <p className="mt-4 text-center text-sm text-ink-muted">
            <span className="font-medium text-ink dark:text-white">Break idea:</span> {showBreak}
          </p>
        ) : null}
      </section>

      <section className="border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <h2 className="text-title-sm text-ink dark:text-white">Ambient sound</h2>
        <p className="mt-1 text-sm text-ink-muted">Low-volume noise while focusing. Stops when you leave the tab or refresh.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["off", "white", "pink", "brown"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={ambient === k ? "btn btn-primary min-h-10 capitalize" : "btn surface-muted min-h-10 capitalize"}
              onClick={() => toggleAmbient(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </section>

      <section className="border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <h2 className="text-title-sm text-ink dark:text-white">Focus history</h2>
        <p className="mt-1 text-sm text-ink-muted">Daily minutes from completed focus blocks.</p>
        <div className="mt-4 h-56 min-h-[14rem] w-full sm:h-64">
          <InlineLineChart data={dailyTotals} xKey="day" yKey="minutes" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn surface-muted min-h-10 px-4"
            onClick={() => {
              const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "pomodoro-history.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download JSON
          </button>
          <button
            type="button"
            className="btn surface-muted min-h-10 px-4 text-red-600 dark:text-red-400"
            onClick={() => {
              if (confirm("Clear all pomodoro history?")) setHistory([]);
            }}
          >
            Clear history
          </button>
        </div>
      </section>
    </div>
  );
}

function InlineLineChart<T extends Record<string, any>>({ data, xKey, yKey }: { data: T[]; xKey: keyof T; yKey: keyof T }) {
  const width = 600; const height = 240; const pad = 32; const innerW = width - pad * 2; const innerH = height - pad * 2;
  const maxY = Math.max(1, ...data.map(d => Number(d[yKey]) || 0));
  const n = Math.max(1, data.length);
  const points = data.map((d, i) => {
    const x = pad + (innerW / (n - 1 || 1)) * i;
    const val = Number(d[yKey]) || 0;
    const y = pad + innerH - (val / maxY) * innerH;
    return `${x},${y}`;
  }).join(' ');
  const grid = "rgb(var(--tw-ink-faint) / 0.35)";
  const label = "rgb(var(--tw-ink-muted))";
  const line = "rgb(var(--tw-accent))";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden>
      <rect x={pad} y={pad} width={innerW} height={innerH} fill="none" stroke={grid} />
      {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => (
        <g key={idx}>
          <line x1={pad} x2={width - pad} y1={pad + innerH - innerH * f} y2={pad + innerH - innerH * f} stroke={grid} />
          <text x={8} y={pad + innerH - innerH * f} fontSize="10" fill={label} dominantBaseline="middle">
            {Math.round(maxY * f)}
          </text>
        </g>
      ))}
      <polyline fill="none" stroke={line} strokeWidth="2" points={points} opacity={0.9} />
      {data.map((d, i) => {
        const x = pad + (innerW / (n - 1 || 1)) * i;
        return (
          <text key={i} x={x} y={height - 8} fontSize="10" textAnchor="middle" fill={label}>
            {String(d[xKey]).slice(5)}
          </text>
        );
      })}
    </svg>
  );
}
