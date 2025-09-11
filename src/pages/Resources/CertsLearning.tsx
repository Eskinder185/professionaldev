import { useEffect, useMemo, useRef, useState } from "react";
import SectionHeader from "../../components/SectionHeader";
import Card from "../../components/Card";
import { CERT_PATHS, Path } from "../../data/resources/certs";

type CheckMap = Record<string, boolean>;

export default function CertsLearning() {
  const [current, setCurrent] = useState<Path>(() => {
    const id = localStorage.getItem("pd:resources:certs:path") as Path["id"] | null;
    const found = CERT_PATHS.find((p) => p.id === id) || CERT_PATHS[0];
    return found;
  });
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(() => Number(localStorage.getItem("pd:resources:certs:hpw")) || 10);
  const [done, setDone] = useState<CheckMap>(() => {
    try { return JSON.parse(localStorage.getItem(`pd:resources:certs:${current.id}:done`) || "{}"); } catch { return {}; }
  });
  const [links, setLinks] = useState<{ title: string; url: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("pd:resources:certs:links") || "[]"); } catch { return []; }
  });
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem("pd:resources:certs:path", current.id); }, [current.id]);
  useEffect(() => { localStorage.setItem("pd:resources:certs:hpw", String(hoursPerWeek)); }, [hoursPerWeek]);
  useEffect(() => { localStorage.setItem(`pd:resources:certs:${current.id}:done`, JSON.stringify(done)); }, [done, current.id]);
  useEffect(() => { localStorage.setItem("pd:resources:certs:links", JSON.stringify(links)); }, [links]);

  const totalHours = current.steps.reduce((s, x) => s + x.hours, 0);
  const weeks = Math.max(1, Math.ceil(totalHours / Math.max(1, hoursPerWeek)));
  const finishDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);
  const finishBy = finishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Schedule: fill weeks by accumulating hours until hoursPerWeek, then move to next week
  const schedule = useMemo(() => {
    const out: { week: number; stepId: string; title: string; hours: number; type: string }[] = [];
    let w = 1, rem = hoursPerWeek;
    for (const s of current.steps) {
      let h = s.hours; let title = s.title; let id = s.id;
      while (h > 0) {
        const take = Math.min(h, rem);
        out.push({ week: w, stepId: id, title, hours: take, type: s.type });
        h -= take; rem -= take;
        if (rem === 0 && (h > 0)) { w += 1; rem = hoursPerWeek; }
      }
      if (rem === 0) { w += 1; rem = hoursPerWeek; }
    }
    return out;
  }, [current, hoursPerWeek]);

  const progress = Math.round((current.steps.filter((s) => done[s.id]).length / current.steps.length) * 100);

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const jspdfName = 'jspdf'; const html2canvasName = 'html2canvas';
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import(/* @vite-ignore */ (jspdfName as any)),
      import(/* @vite-ignore */ (html2canvasName as any)),
    ]);
    const canvas = await (html2canvas as any).default(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new (jsPDF as any)({ unit: 'pt', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth(); const h = canvas.height * (w / canvas.width);
    pdf.addImage(img, 'PNG', 0, 0, w, h); pdf.save('certs-plan.pdf');
  };

  return (
    <div className="relative">
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-6">
        <SectionHeader title="Certifications & Learning" subtitle="Pick a path, plan by week, and track progress." />

        <Card>
          <div className="flex flex-wrap gap-2">
            {CERT_PATHS.map((p) => (
              <button key={p.id} className={`px-3 py-1 rounded border ${p.id===current.id?'bg-white/10':''}`} onClick={()=>{ setCurrent(p); setDone(()=>{ try { return JSON.parse(localStorage.getItem(`pd:resources:certs:${p.id}:done`) || "{}"); } catch { return {}; } }); }}> {p.title} </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">Hours/week<input aria-label="Hours per week" type="number" min={1} className="w-20 rounded p-1 border border-white/10 bg-white/5" value={hoursPerWeek} onChange={(e)=>setHoursPerWeek(Math.max(1, Number(e.target.value)||1))} /></label>
            <div>Estimate: {weeks} weeks (finish by {finishBy})</div>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-white/10 rounded"><div className="h-2 bg-blue-600 rounded" style={{ width: `${progress}%` }} /></div>
            <div className="text-xs opacity-70 mt-1">Progress: {progress}%</div>
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-2">Weekly plan</div>
          <div ref={reportRef}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left"><th>Week</th><th>Step</th><th>Hours</th><th>Type</th><th>Done</th></tr>
              </thead>
              <tbody>
                {schedule.map((row, i) => (
                  <tr key={i} className="border-b border-white/10">
                    <td className="py-1">{row.week}</td>
                    <td className="py-1">{row.title}</td>
                    <td className="py-1">{row.hours}</td>
                    <td className="py-1 capitalize">{row.type}</td>
                    <td className="py-1"><input type="checkbox" checked={!!done[row.stepId]} onChange={(e)=>setDone({...done, [row.stepId]: e.target.checked})} aria-label={`Mark ${row.title} done`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><button className="px-3 py-1 rounded border" onClick={exportPDF}>Download plan as PDF</button></div>
        </Card>

        <Card>
          <div className="font-medium mb-2">Resources</div>
          <div className="flex gap-2 mb-2">
            <button className="px-3 py-1 rounded border" onClick={()=>setLinks([...links,{title:"",url:""}])}>Add link</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {links.map((r, i) => (
              <input key={i} className="rounded p-2 border border-white/10 bg-white/5" placeholder="Title — URL" value={`${r.title}|${r.url}`}
                onChange={(e)=>{ const [t,u] = e.target.value.split('|'); const copy=[...links]; copy[i] = { title: t||"", url: u||"" }; setLinks(copy); }} />
            ))}
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {links.filter(l=>l.title && l.url).map((l, i) => (
              <a key={i} className="px-2 py-1 rounded-full text-xs border border-white/15 bg-white/10" href={l.url} target="_blank" rel="noreferrer">{l.title}</a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
