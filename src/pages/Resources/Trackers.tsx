import { useMemo, useState } from "react";
import SectionHeader from "../../components/SectionHeader";
import Card from "../../components/Card";
// Lightweight CSV helpers to avoid external deps
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const split = (line: string) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"')); 
  const headers = split(lines[0]).map(h => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}
function toCSV(rows: Record<string, any>[], headers: string[]): string {
  const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const head = headers.join(',');
  const body = rows.map(r => headers.map(h => esc(r[h])).join(',')).join('\n');
  return [head, body].join('\n');
}
// Inline SVG chart fallback to avoid external chart deps

type Skill = { skill: string; level: number; hours: number; notes: string; lastPracticed?: string };
type AppRow = { company: string; role: string; link: string; status: string; nextAction: string; due?: string; remind?: boolean };

export default function Trackers() {
  const [tab, setTab] = useState<"skills" | "apps">("skills");

  // Skills
  const [skills, setSkills] = useState<Skill[]>(() => {
    try { return JSON.parse(localStorage.getItem("pd:resources:skills:list") || "[]"); } catch { return []; }
  });
  const [sd, setSd] = useState<Skill>({ skill: "", level: 3, hours: 1, notes: "" });

  const saveSkills = (arr: Skill[]) => { setSkills(arr); localStorage.setItem("pd:resources:skills:list", JSON.stringify(arr)); };

  const totalHours = useMemo(() => skills.reduce((s, x) => s + (Number(x.hours) || 0), 0), [skills]);
  const avgLevel = useMemo(() => skills.length ? Math.round((skills.reduce((s,x)=>s+(Number(x.level)||0),0)/skills.length)*10)/10 : 0, [skills]);

  const exportSkills = () => {
    const csv = toCSV(skills as any, ["skill","level","hours","notes","lastPracticed"]);
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "skills.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const importSkills = async (file: File) => {
    const text = await file.text();
    const data = parseCSV(text);
    saveSkills(data.map((r) => ({ skill: r.skill || "", level: Number(r.level)||0, hours: Number(r.hours)||0, notes: r.notes||"", lastPracticed: r.lastPracticed||"" })));
  };

  // Apps
  const [apps, setApps] = useState<AppRow[]>(() => {
    try { return JSON.parse(localStorage.getItem("pd:resources:apps:list") || "[]"); } catch { return []; }
  });
  const [ad, setAd] = useState<AppRow>({ company: "", role: "", link: "", status: "Applied", nextAction: "", due: "", remind: false });
  const [filter, setFilter] = useState<string>("all");
  const saveApps = (arr: AppRow[]) => { setApps(arr); localStorage.setItem("pd:resources:apps:list", JSON.stringify(arr)); };

  const exportApps = () => {
    const csv = toCSV(apps as any, ["company","role","link","status","nextAction","due"]);
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "applications.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const importApps = async (file: File) => {
    const text = await file.text();
    const data = parseCSV(text);
    saveApps(data.map((r) => ({ company: r.company||"", role: r.role||"", link: r.link||"", status: r.status||"Applied", nextAction: r.nextAction||"", due: r.due||"" })));
  };

  const filtered = apps.filter(a => filter==='all' ? true : a.status === filter);

  return (
    <div className="relative">
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-6">
        <SectionHeader title="Trackers" subtitle="Skills and job applications with CSV import/export." />

        <div className="flex gap-2">
          <button className={`px-3 py-1 rounded border ${tab==='skills'?'bg-white/10':''}`} onClick={()=>setTab('skills')}>Skills</button>
          <button className={`px-3 py-1 rounded border ${tab==='apps'?'bg-white/10':''}`} onClick={()=>setTab('apps')}>Applications</button>
        </div>

        {tab === 'skills' && (
          <>
            <Card>
              <div className="grid md:grid-cols-5 gap-2 items-end">
                <input aria-label="Skill" className="rounded p-2 border border-white/10 bg-white/5" placeholder="Skill" value={sd.skill} onChange={(e)=>setSd({...sd, skill: e.target.value})} />
                <input aria-label="Level" type="number" min={1} max={5} className="rounded p-2 border border-white/10 bg-white/5" placeholder="Level 1-5" value={sd.level} onChange={(e)=>setSd({...sd, level: Number(e.target.value)})} />
                <input aria-label="Hours" type="number" min={0} className="rounded p-2 border border-white/10 bg-white/5" placeholder="Hours" value={sd.hours} onChange={(e)=>setSd({...sd, hours: Number(e.target.value)})} />
                <input aria-label="Notes" className="rounded p-2 border border-white/10 bg-white/5" placeholder="Notes" value={sd.notes} onChange={(e)=>setSd({...sd, notes: e.target.value})} />
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={()=>saveSkills([...skills, sd])}>Add</button>
              </div>
              <div className="mt-3 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="text-left"><th>Skill</th><th>Level</th><th>Hours</th><th>Notes</th><th>Last</th><th></th></tr></thead>
                  <tbody>
                    {skills.map((s, i) => (
                      <tr key={i} className="border-b border-white/10">
                        <td><input className="bg-transparent" value={s.skill} onChange={(e)=>{ const copy=[...skills]; copy[i].skill=e.target.value; saveSkills(copy); }} /></td>
                        <td><input type="number" min={1} max={5} className="w-16 bg-transparent" value={s.level} onChange={(e)=>{ const copy=[...skills]; copy[i].level=Number(e.target.value); saveSkills(copy); }} /></td>
                        <td><input type="number" className="w-20 bg-transparent" value={s.hours} onChange={(e)=>{ const copy=[...skills]; copy[i].hours=Number(e.target.value); saveSkills(copy); }} /></td>
                        <td><input className="w-full bg-transparent" value={s.notes} onChange={(e)=>{ const copy=[...skills]; copy[i].notes=e.target.value; saveSkills(copy); }} /></td>
                        <td><input type="date" className="bg-transparent" value={s.lastPracticed||""} onChange={(e)=>{ const copy=[...skills]; copy[i].lastPracticed=e.target.value; saveSkills(copy); }} /></td>
                        <td><button className="px-2 py-1 rounded border text-red-500" onClick={()=>saveSkills(skills.filter((_,j)=>j!==i))}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1 rounded border" onClick={exportSkills}>Export CSV</button>
                <label className="px-3 py-1 rounded border cursor-pointer">Import CSV<input type="file" accept=".csv" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) importSkills(f); }} /></label>
              </div>
            </Card>
            <Card>
              <div className="text-sm">Total hours: {totalHours} • Avg level: {avgLevel}</div>
              <div className="h-64 w-full">
                <InlineBarChart data={skills} xKey="skill" yKey="hours" />
              </div>
            </Card>

            
          </>
        )}

        {tab === 'apps' && (
          <>
            <Card>
              <div className="grid md:grid-cols-6 gap-2 items-end">
                <input className="rounded p-2 border border-white/10 bg-white/5" placeholder="Company" value={ad.company} onChange={(e)=>setAd({...ad, company: e.target.value})} />
                <input className="rounded p-2 border border-white/10 bg-white/5" placeholder="Role" value={ad.role} onChange={(e)=>setAd({...ad, role: e.target.value})} />
                <input className="rounded p-2 border border-white/10 bg-white/5" placeholder="Link" value={ad.link} onChange={(e)=>setAd({...ad, link: e.target.value})} />
                <select className="rounded p-2 border border-white/10 bg-white/5" value={ad.status} onChange={(e)=>setAd({...ad, status: e.target.value})}>
                  {['Applied','Phone Screen','Interview','Offer','Rejected'].map(s=>(<option key={s}>{s}</option>))}
                </select>
                <input className="rounded p-2 border border-white/10 bg-white/5" placeholder="Next action" value={ad.nextAction} onChange={(e)=>setAd({...ad, nextAction: e.target.value})} />
                <input type="date" className="rounded p-2 border border-white/10 bg-white/5" value={ad.due||""} onChange={(e)=>setAd({...ad, due: e.target.value})} />
              </div>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={()=>saveApps([ad, ...apps])}>Add</button>
                <select className="ml-auto rounded p-2 border border-white/10 bg-white/5" value={filter} onChange={(e)=>setFilter(e.target.value)}>
                  {['all','Applied','Phone Screen','Interview','Offer','Rejected'].map(s=>(<option key={s} value={s}>{s}</option>))}
                </select>
                <button className="px-3 py-1 rounded border" onClick={exportApps}>Export CSV</button>
                <label className="px-3 py-1 rounded border cursor-pointer">Import CSV<input type="file" accept=".csv" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) importApps(f); }} /></label>
              </div>
            </Card>
            <Card>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="text-left"><th>Company</th><th>Role</th><th>Link</th><th>Status</th><th>Next</th><th>Due</th><th></th></tr></thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const soon = r.due ? (Math.ceil((new Date(r.due).getTime() - Date.now()) / (1000*60*60*24)) <= 3) : false;
                      return (
                        <tr key={i} className={`border-b border-white/10 ${soon?'bg-yellow-500/10':''}`}>
                          <td><input className="bg-transparent" value={r.company} onChange={(e)=>{ const copy=[...apps]; copy[i].company=e.target.value; saveApps(copy);} } /></td>
                          <td><input className="bg-transparent" value={r.role} onChange={(e)=>{ const copy=[...apps]; copy[i].role=e.target.value; saveApps(copy);} } /></td>
                          <td><input className="bg-transparent" value={r.link} onChange={(e)=>{ const copy=[...apps]; copy[i].link=e.target.value; saveApps(copy);} } /></td>
                          <td>
                            <select className="bg-transparent" value={r.status} onChange={(e)=>{ const copy=[...apps]; copy[i].status=e.target.value; saveApps(copy);} }>
                              {['Applied','Phone Screen','Interview','Offer','Rejected'].map(s=>(<option key={s}>{s}</option>))}
                            </select>
                          </td>
                          <td><input className="bg-transparent" value={r.nextAction} onChange={(e)=>{ const copy=[...apps]; copy[i].nextAction=e.target.value; saveApps(copy);} } /></td>
                          <td><input type="date" className="bg-transparent" value={r.due||""} onChange={(e)=>{ const copy=[...apps]; copy[i].due=e.target.value; saveApps(copy);} } /></td>
                          <td><button className="px-2 py-1 rounded border text-red-500" onClick={()=>saveApps(apps.filter((_,j)=>j!==i))}>Delete</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function InlineBarChart<T extends Record<string, any>>({ data, xKey, yKey }: { data: T[]; xKey: keyof T; yKey: keyof T }) {
  const width = 600; const height = 240; const pad = 32; const innerW = width - pad * 2; const innerH = height - pad * 2;
  const maxY = Math.max(1, ...data.map(d => Number(d[yKey]) || 0));
  const barW = data.length ? innerW / data.length * 0.6 : 0;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <rect x={pad} y={pad} width={innerW} height={innerH} fill="none" stroke="#e5e7eb" />
      {data.map((d, i) => {
        const x = pad + (innerW / Math.max(1, data.length)) * i + ((innerW / Math.max(1, data.length)) - barW) / 2;
        const val = Number(d[yKey]) || 0;
        const h = (val / maxY) * innerH;
        const y = pad + innerH - h;
        return <rect key={i} x={x} y={y} width={barW} height={h} fill="#60a5fa" />
      })}
      {data.map((d, i) => {
        const x = pad + (innerW / Math.max(1, data.length)) * i + (innerW / Math.max(1, data.length)) / 2;
        return <text key={`t${i}`} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7280">{String(d[xKey]).slice(0,8)}</text>
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => (
        <g key={idx}>
          <line x1={pad} x2={width - pad} y1={pad + innerH - innerH * f} y2={pad + innerH - innerH * f} stroke="#e5e7eb" />
          <text x={8} y={pad + innerH - innerH * f} fontSize="10" fill="#6b7280" dominantBaseline="middle">{Math.round(maxY * f)}</text>
        </g>
      ))}
    </svg>
  );
}

