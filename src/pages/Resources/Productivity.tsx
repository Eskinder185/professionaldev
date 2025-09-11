import { useEffect, useRef, useState } from "react";
import SectionHeader from "../../components/SectionHeader";
import Card from "../../components/Card";
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
    <div className="relative">
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 space-y-6">
        <SectionHeader title="Time & Productivity" subtitle="Pomodoro with auto-cycles and focus tools." />

        <Card>
          <div className="font-medium mb-2">Settings</div>
          <div className="grid md:grid-cols-5 gap-2">
            <label className="text-sm">Focus (min)
              <input type="number" className="w-full rounded p-2 border border-white/10 bg-white/5" value={settings.focusMin} onChange={(e)=>setSettings({...settings, focusMin: Number(e.target.value)||25})} />
            </label>
            <label className="text-sm">Short (min)
              <input type="number" className="w-full rounded p-2 border border-white/10 bg-white/5" value={settings.shortMin} onChange={(e)=>setSettings({...settings, shortMin: Number(e.target.value)||5})} />
            </label>
            <label className="text-sm">Long (min)
              <input type="number" className="w-full rounded p-2 border border-white/10 bg-white/5" value={settings.longMin} onChange={(e)=>setSettings({...settings, longMin: Number(e.target.value)||15})} />
            </label>
            <label className="text-sm">Cycles before long
              <input type="number" className="w-full rounded p-2 border border-white/10 bg-white/5" value={settings.cyclesBeforeLong} onChange={(e)=>setSettings({...settings, cyclesBeforeLong: Number(e.target.value)||4})} />
            </label>
            <label className="text-sm flex items-center gap-2">Auto-start
              <input type="checkbox" checked={settings.autoStartNext} onChange={(e)=>setSettings({...settings, autoStartNext: e.target.checked})} />
            </label>
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-2">Timer — {mode}</div>
          <div className="text-5xl font-mono text-center">{mm}:{ss}</div>
          <div className="mt-2 flex gap-2 justify-center">
            {!running ? <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={()=>setRunning(true)}>Start</button> : <button className="px-4 py-2 rounded border" onClick={()=>setRunning(false)}>Pause</button>}
            <button className="px-4 py-2 rounded border" onClick={()=>{ setRunning(false); setRemaining(durationFor(mode, settings)*60); }}>Reset</button>
            <button className="px-4 py-2 rounded border" onClick={()=>{ const n=nextMode(mode, cycle+1, settings); setMode(n); }}>Skip</button>
          </div>
          {showBreak && <div className="mt-3 text-center text-sm">Break idea: {showBreak}</div>}
        </Card>

        <Card>
          <div className="font-medium mb-2">Focus Tools</div>
          <div className="flex gap-2 items-center">
            <span className="text-sm">Ambient:</span>
            {(['off','white','pink','brown'] as const).map((k) => (
              <button key={k} className={`px-3 py-1 rounded border ${ambient===k?'bg-white/10':''}`} onClick={()=>toggleAmbient(k)}>{k}</button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-2">History</div>
          <div className="h-64">
            <InlineLineChart data={dailyTotals} xKey="day" yKey="minutes" />
          </div>
          <div className="mt-2 flex gap-2">
            <button className="px-3 py-1 rounded border" onClick={()=>{ const blob = new Blob([JSON.stringify(history,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='pomodoro-history.json'; a.click(); URL.revokeObjectURL(url); }}>Download history JSON</button>
            <button className="px-3 py-1 rounded border text-red-500" onClick={()=>{ if(confirm('Clear history?')) setHistory([]); }}>Clear history</button>
          </div>
        </Card>
      </div>
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
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <rect x={pad} y={pad} width={innerW} height={innerH} fill="none" stroke="#e5e7eb" />
      {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => (
        <g key={idx}>
          <line x1={pad} x2={width - pad} y1={pad + innerH - innerH * f} y2={pad + innerH - innerH * f} stroke="#e5e7eb" />
          <text x={8} y={pad + innerH - innerH * f} fontSize="10" fill="#6b7280" dominantBaseline="middle">{Math.round(maxY * f)}</text>
        </g>
      ))}
      <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={points} />
      {data.map((d, i) => {
        const x = pad + (innerW / (n - 1 || 1)) * i;
        return <text key={i} x={x} y={height - 8} fontSize="10" textAnchor="middle" fill="#6b7280">{String(d[xKey]).slice(5)}</text>;
      })}
    </svg>
  );
}
