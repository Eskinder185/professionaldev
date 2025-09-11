import { useMemo, useRef, useState } from "react";
 
import SectionHeader from "../../components/SectionHeader";
import Card from "../../components/Card";
import { CORE_VALUES } from "../../data/self/coreValues";
import { load, save } from "../../utils/storage";

type Item = { value: string; rank: number };

export default function CoreValues() {
  const [items, setItems] = useState<Item[]>(() => {
    const saved = load<Item[]>("pd:self:values:rank", []);
    if (saved.length) return saved;
    return CORE_VALUES.map((v, i) => ({ value: v, rank: i + 1 }));
  });
  const [notes, setNotes] = useState<string>(() => load("pd:self:values:notes", ""));
  const ref = useRef<HTMLDivElement>(null);

  const move = (idx: number, dir: -1 | 1) => {
    const copy = [...items];
    const j = idx + dir;
    if (j < 0 || j >= copy.length) return;
    const tmp = copy[idx]; copy[idx] = copy[j]; copy[j] = tmp;
    copy.forEach((v, i) => (v.rank = i + 1));
    setItems(copy);
  };

  const statement = useMemo(() => {
    const top = items.slice(0, 3).map((i) => i.value);
    if (top.length < 3) return "";
    return `I thrive in roles prioritizing ${top[0]}, ${top[1]}, and ${top[2]}; I avoid roles that undermine these.`;
  }, [items]);

  const exportPDF = async () => {
    const jspdfName = 'jspdf'; const html2canvasName = 'html2canvas';
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import(/* @vite-ignore */ (jspdfName as any)),
      import(/* @vite-ignore */ (html2canvasName as any)),
    ]);
    const el = ref.current; if (!el) return;
    const canvas = await (html2canvas as any).default(el, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new (jsPDF as any)({ unit: 'pt', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth(); const h = canvas.height * (w / canvas.width);
    pdf.addImage(img, 'PNG', 0, 0, w, h); pdf.save('core-values.pdf');
  };

  const saveAll = () => { save("pd:self:values:rank", items); save("pd:self:values:notes", notes); };

  return (
    <div className="relative">
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 space-y-6">
        <SectionHeader title="Core Values Workshop" subtitle="Rank, reflect, and generate your job filter." />
        <Card>
          <div className="font-medium mb-2">Rank your values</div>
          <ul className="space-y-2">
            {items.map((it, idx) => (
              <li key={it.value} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center opacity-70">{idx + 1}</span>
                  <span>{it.value}</span>
                </div>
                <div className="flex gap-2">
                  <button className="px-2 py-1 rounded border" aria-label="Move up" onClick={() => move(idx, -1)} onKeyDown={(e)=>{ if(e.key==='ArrowUp'){ e.preventDefault(); move(idx,-1);} }}>↑</button>
                  <button className="px-2 py-1 rounded border" aria-label="Move down" onClick={() => move(idx, 1)} onKeyDown={(e)=>{ if(e.key==='ArrowDown'){ e.preventDefault(); move(idx,1);} }}>↓</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="font-medium mb-2">Reflection prompts</div>
          <div className="grid md:grid-cols-3 gap-3">
            {["When have you felt most energized at work?","What trade-off are you unwilling to make?","What environment makes you do your best work?"].map((q,i)=>(
              <textarea key={i} className="w-full h-28 p-2 rounded border border-white/10 bg-white/5" placeholder={q} value={notes} onChange={(e)=>setNotes(e.target.value)} />
            ))}
          </div>
        </Card>

        <Card>
          <div ref={ref}>
            <div className="font-medium mb-2">My job filter</div>
            <p className="text-white/90">{statement}</p>
            <ol className="mt-3 list-decimal pl-5">
              {items.map((i) => (<li key={i.value}>{i.value}</li>))}
            </ol>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-1 rounded border" onClick={saveAll}>Save</button>
            <button className="px-3 py-1 rounded border" onClick={exportPDF}>Export PDF</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

