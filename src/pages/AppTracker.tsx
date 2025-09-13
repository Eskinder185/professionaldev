import { useEffect, useMemo, useState } from "react";

type AppItem = { id: string; company: string; role: string; status: string; date: string; notes?: string };

function toCSV(items: AppItem[]) {
  const header = ["Company","Role","Status","Date","Notes"].join(",");
  const rows = items.map(i => [i.company, i.role, i.status, i.date, (i.notes||"").replace(/\n/g, " ")].map(v => '"' + (v||'').replace(/"/g,'""') + '"').join(","));
  return [header, ...rows].join("\n");
}
function fromCSV(text: string): Omit<AppItem, "id">[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const rows = lines.slice(1).map((l) => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.replace(/^"|"$/g, '').replace(/""/g, '"')));
  return rows.map((r) => ({ company: r[0]||"", role: r[1]||"", status: r[2]||"Applied", date: r[3]||new Date().toISOString().slice(0,10), notes: r[4]||"" }));
}

export default function AppTracker() {
  const [items, setItems] = useState<AppItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("appTracker:items") || "[]"); } catch { return []; }
  });
  const [draft, setDraft] = useState<Omit<AppItem, "id">>({ company: "", role: "", status: "Applied", date: new Date().toISOString().slice(0,10), notes: "" });

  useEffect(() => { try { localStorage.setItem("appTracker:items", JSON.stringify(items)); } catch {} }, [items]);

  const add = () => {
    setItems([{ id: crypto.randomUUID(), ...draft }, ...items]);
    setDraft({ company: "", role: "", status: draft.status, date: new Date().toISOString().slice(0,10), notes: "" });
  };
  const remove = (id: string) => setItems(items.filter(i => i.id !== id));
  const update = (id: string, patch: Partial<AppItem>) => setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));

  const exportCsv = () => {
    const blob = new Blob([toCSV(items)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "applications.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = fromCSV(text);
    setItems([...rows.map((r) => ({ id: crypto.randomUUID(), ...r })), ...items]);
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) map[i.status] = (map[i.status]||0)+1;
    return map;
  }, [items]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Application Tracker</h1>
      <p className="text-gray-600">Track applications, statuses, and notes. Import/export CSV. Data stays in your browser.</p>

      <div className="surface p-4 grid md:grid-cols-5 gap-2 items-end">
        <div className="md:col-span-1">
          <label className="block text-sm text-gray-600">Company</label>
          <input className="w-full rounded border border-gray-200 p-2" value={draft.company} onChange={(e)=>setDraft({...draft, company: e.target.value})} />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm text-gray-600">Role</label>
          <input className="w-full rounded border border-gray-200 p-2" value={draft.role} onChange={(e)=>setDraft({...draft, role: e.target.value})} />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm text-gray-600">Status</label>
          <select className="w-full rounded border border-gray-200 p-2" value={draft.status} onChange={(e)=>setDraft({...draft, status: e.target.value})}>
            {['Applied','Phone Screen','Interview','Offer','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm text-gray-600">Date</label>
          <input type="date" className="w-full rounded border border-gray-200 p-2" value={draft.date} onChange={(e)=>setDraft({...draft, date: e.target.value})} />
        </div>
        <div className="md:col-span-1">
          <button className="w-full px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={add}>Add</button>
        </div>
        <div className="md:col-span-5">
          <label className="block text-sm text-gray-600">Notes</label>
          <textarea className="w-full h-20 rounded border border-gray-200 p-2" value={draft.notes} onChange={(e)=>setDraft({...draft, notes: e.target.value})} />
        </div>
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-1 rounded border" onClick={exportCsv}>Export CSV</button>
        <label className="px-3 py-1 rounded border cursor-pointer">Import CSV
          <input type="file" accept=".csv" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) importCsv(f); }} />
        </label>
      </div>

      <div className="surface p-4">
        <div className="font-medium mb-2">Summary</div>
        <div className="flex flex-wrap gap-3 text-sm">
          {Object.entries(counts).map(([k,v]) => (
            <div key={k} className="px-2 py-1 rounded border">{k}: {v}</div>
          ))}
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Company</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Notes</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="py-2 pr-4"><input className="w-full" value={i.company} onChange={(e)=>update(i.id,{company:e.target.value})} /></td>
                <td className="py-2 pr-4"><input className="w-full" value={i.role} onChange={(e)=>update(i.id,{role:e.target.value})} /></td>
                <td className="py-2 pr-4">
                  <select value={i.status} onChange={(e)=>update(i.id,{status:e.target.value})}>
                    {['Applied','Phone Screen','Interview','Offer','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-4"><input type="date" value={i.date} onChange={(e)=>update(i.id,{date:e.target.value})} /></td>
                <td className="py-2 pr-4"><input className="w-full" value={i.notes||""} onChange={(e)=>update(i.id,{notes:e.target.value})} /></td>
                <td className="py-2"><button className="px-2 py-1 rounded border text-red-600" onClick={()=>remove(i.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

