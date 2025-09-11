import { useMemo, useRef, useState } from "react";
import SectionHeader from "../../components/SectionHeader";
import Card from "../../components/Card";
import { load, save } from "../../utils/storage";

type Entry = { id: string; date: string; title: string; win: string; blocker: string; next: string; tags: string[] };

export default function JournalStudio() {
  const [entries, setEntries] = useState<Entry[]>(() => load("pd:self:journal:entries", []));
  const [draft, setDraft] = useState<Entry>({ id: "", date: new Date().toISOString().slice(0,10), title: "", win: "", blocker: "", next: "", tags: [] });
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  const saveDraft = () => {
    const id = crypto.randomUUID();
    const item: Entry = { ...draft, id, tags: (draft.tags||[]).filter(Boolean) };
    const next = [item, ...entries]; setEntries(next); save("pd:self:journal:entries", next);
    setDraft({ id: "", date: new Date().toISOString().slice(0,10), title: "", win: "", blocker: "", next: "", tags: [] });
  };
  const remove = (id: string) => { const next = entries.filter(e => e.id !== id); setEntries(next); save("pd:self:journal:entries", next); };

  const filtered = useMemo(() => entries.filter(e => (
    (!q || (e.title+e.win+e.blocker+e.next).toLowerCase().includes(q.toLowerCase())) &&
    (!tag || e.tags.includes(tag))
  )), [entries, q, tag]);

  const exportMD = () => {
    const md = filtered.map(e => `# ${e.title} (${e.date})\n\n- Win: ${e.win}\n- Blocker: ${e.blocker}\n- Next: ${e.next}\n- Tags: ${e.tags.join(', ')}\n`).join("\n\n");
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'journal.md'; a.click(); URL.revokeObjectURL(url);
  };
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
    pdf.addImage(img, 'PNG', 0, 0, w, h); pdf.save('journal.pdf');
  };

  return (
    <div className="relative">
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 space-y-6">
        <SectionHeader title="Journaling Studio" subtitle="Daily prompts with tags and export." />
        <Card>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Date</label>
              <input type="date" className="w-full rounded p-2 border border-white/10 bg-white/5" value={draft.date} onChange={(e)=>setDraft({...draft, date: e.target.value})} />
            </div>
            <div>
              <label className="text-sm">Title</label>
              <input className="w-full rounded p-2 border border-white/10 bg-white/5" value={draft.title} onChange={(e)=>setDraft({...draft, title: e.target.value})} />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mt-3">
            <textarea placeholder="Win" className="h-24 p-2 rounded border border-white/10 bg-white/5" value={draft.win} onChange={(e)=>setDraft({...draft, win: e.target.value})} />
            <textarea placeholder="Blocker" className="h-24 p-2 rounded border border-white/10 bg-white/5" value={draft.blocker} onChange={(e)=>setDraft({...draft, blocker: e.target.value})} />
            <textarea placeholder="Next Action" className="h-24 p-2 rounded border border-white/10 bg-white/5" value={draft.next} onChange={(e)=>setDraft({...draft, next: e.target.value})} />
          </div>
          <div className="mt-3">
            <input placeholder="tags (comma separated)" className="w-full rounded p-2 border border-white/10 bg-white/5" value={draft.tags.join(', ')} onChange={(e)=>setDraft({...draft, tags: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} />
          </div>
          <div className="mt-3">
            <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={saveDraft}>Save</button>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap gap-2 mb-3">
            <input placeholder="search" className="rounded p-2 border border-white/10 bg-white/5" value={q} onChange={(e)=>setQ(e.target.value)} />
            <input placeholder="tag" className="rounded p-2 border border-white/10 bg-white/5" value={tag} onChange={(e)=>setTag(e.target.value)} />
            <button className="px-3 py-1 rounded border" onClick={exportMD}>Export MD</button>
            <button className="px-3 py-1 rounded border" onClick={exportPDF}>Export PDF</button>
          </div>
          <div ref={reportRef} className="space-y-3">
            {filtered.map((e) => (
              <div key={e.id} className="rounded border border-white/10 bg-white/5 p-3">
                <div className="flex justify-between"><div className="font-medium">{e.title}</div><div className="text-sm opacity-70">{e.date}</div></div>
                <div className="text-sm mt-1">Win: {e.win}</div>
                <div className="text-sm">Blocker: {e.blocker}</div>
                <div className="text-sm">Next: {e.next}</div>
                <div className="text-xs opacity-70 mt-1">Tags: {e.tags.join(', ')}</div>
                <div className="mt-2"><button className="px-2 py-1 rounded border text-red-500" onClick={()=>remove(e.id)}>Delete</button></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
