import { useEffect, useMemo, useRef, useState } from "react";
import SectionHeader from "../../components/SectionHeader";
import Card from "../../components/Card";
import { load, save } from "../../utils/storage";

type Story = { id: string; situation: string; task: string; action: string; result: string; tightened?: boolean; date: string };

const FILLERS = ["really","very","just","quite","like","you know","basically","actually","so"];

export default function StarTool() {
  const [step, setStep] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState<Story>(() => ({ id: "", situation: "", task: "", action: "", result: "", date: new Date().toISOString() }));
  const [library, setLibrary] = useState<Story[]>(() => load("pd:career:star:stories", []));
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!timerOn) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [timerOn]);

  const tightenedText = useMemo(() => {
    const join = `${draft.situation} ${draft.task} ${draft.action} ${draft.result}`;
    if (!draft.tightened) return join.trim();
    let t = join;
    for (const f of FILLERS) t = t.replace(new RegExp(`\\b${f}\\b`, 'gi'), '');
    return t.replace(/\s+/g, ' ').trim();
  }, [draft]);

  const saveStory = () => {
    const item: Story = { ...draft, id: crypto.randomUUID(), date: new Date().toISOString() };
    const next = [item, ...library].slice(0, 20);
    setLibrary(next); save("pd:career:star:stories", next);
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const jspdfName='jspdf'; const html2canvasName='html2canvas';
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import(/* @vite-ignore */ (jspdfName as any)),
      import(/* @vite-ignore */ (html2canvasName as any)),
    ]);
    const canvas = await (html2canvas as any).default(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new (jsPDF as any)({ unit: 'pt', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth(); const h = canvas.height * (w / canvas.width);
    pdf.addImage(img, 'PNG', 0, 0, w, h); pdf.save('star-story.pdf');
  };

  const presets: Record<string, Partial<Story>> = {
    leadership: { situation: 'Team faced slipping deadlines after scope changes.', task: 'Stabilize plan and protect quality.', action: 'Re-scoped backlog, added QA gates, set daily syncs.', result: 'Shipped on time with 0 critical bugs.' },
    conflict: { situation: 'Disagreement on tech choice.', task: 'Align team on criteria.', action: 'Facilitated RFC with trade-offs and experiments.', result: 'Consensus on option B; 20% faster builds.' },
    failure: { situation: 'Missed an incident alert.', task: 'Prevent recurrence.', action: 'Implemented on-call runbook and alert tests.', result: 'MTTR down 40% next quarter.' },
  };

  return (
    <div className="relative">
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 space-y-6">
        <SectionHeader title="STAR Method Practice Tool" subtitle="Guided steps with timer, cleanup, and export." />

        <Card>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={timerOn} onChange={(e)=>{ setTimerOn(e.target.checked); if(!e.target.checked) setSeconds(0); }} /> Timer</label>
            {timerOn && <div className="text-sm">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</div>}
            <div className="ml-auto flex gap-2 text-sm">
              <button className="px-2 py-1 rounded border" onClick={()=>setDraft({...draft, tightened: !draft.tightened})} aria-pressed={!!draft.tightened}>Tighten</button>
              <select className="rounded border bg-white/5" onChange={(e)=>{ const p=presets[e.target.value]; if(p) setDraft({...draft, ...p}); }}>
                <option value="">Load scenario…</option>
                <option value="leadership">Leadership</option>
                <option value="conflict">Conflict</option>
                <option value="failure">Failure</option>
              </select>
            </div>
          </div>
        </Card>

        {["Situation","Task","Action","Result"].map((label, i) => (
          <Card key={label}>
            <div className="font-medium mb-2">{label}</div>
            <textarea aria-label={label} className="w-full h-28 p-2 rounded border border-white/10 bg-white/5" value={(draft as any)[label.toLowerCase()]} onChange={(e)=>setDraft({...draft, [label.toLowerCase()]: e.target.value})} />
            <div className="mt-1 text-xs opacity-70">{((draft as any)[label.toLowerCase()]||'').split(/\s+/).filter(Boolean).length} words</div>
            <div className="mt-2 flex justify-between">
              <button className="px-3 py-1 rounded border" onClick={()=>setStep(Math.max(0, step-1))} disabled={i===0}>Back</button>
              <button className="px-3 py-1 rounded border" onClick={()=>setStep(Math.min(3, step+1))} disabled={i===3}>Next</button>
            </div>
          </Card>
        ))}

        <Card>
          <div ref={reportRef}>
            <div className="font-medium mb-2">STAR Story</div>
            <p className="whitespace-pre-wrap">{tightenedText}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-1 rounded border" onClick={saveStory}>Save</button>
            <button className="px-3 py-1 rounded border" onClick={()=>navigator.clipboard?.writeText(tightenedText)}>Copy</button>
            <button className="px-3 py-1 rounded border" onClick={exportPDF}>Export PDF</button>
          </div>
        </Card>

        {library.length > 0 && (
          <Card>
            <div className="font-medium mb-2">Saved Stories</div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {library.map((s) => (
                <li key={s.id}><span className="opacity-70 mr-2">{new Date(s.date).toLocaleString()}:</span>{(s.situation + ' ' + s.task).slice(0, 80)}…</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
