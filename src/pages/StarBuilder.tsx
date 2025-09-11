import { useEffect, useRef, useState } from "react";

type Star = { situation: string; task: string; action: string; result: string; title?: string };

export default function StarBuilder() {
  const [data, setData] = useState<Star>(() => {
    try {
      return JSON.parse(localStorage.getItem("starBuilder:draft") || "{}");
    } catch {
      return {} as any;
    }
  });
  const [step, setStep] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem("starBuilder:draft", JSON.stringify(data)); } catch {}
  }, [data]);

  const next = () => setStep((s) => Math.min(3, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const exportPDF = async () => {
    try {
      const jspdfName = 'jspdf';
      const html2canvasName = 'html2canvas';
      const [{ jsPDF }, html2canvas] = await Promise.all([
        import(/* @vite-ignore */ (jspdfName as any)),
        import(/* @vite-ignore */ (html2canvasName as any)),
      ]);
      const el = previewRef.current;
      if (!el) return;
      const canvas = await (html2canvas as any).default(el, { scale: 2, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/png");
      const pdf = new (jsPDF as any)({ unit: "pt", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, w, h);
      pdf.save("star-story.pdf");
    } catch {
      alert("Install jspdf and html2canvas to export as PDF.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">STAR Builder</h1>
      <p className="text-gray-600">Craft a concise Situation-Task-Action-Result story. Your progress saves automatically.</p>

      <div className="p-4 rounded border border-gray-200 bg-white/70 backdrop-blur">
        <div className="mb-3">
          <label className="block text-sm text-gray-600">Title (optional)</label>
          <input className="w-full rounded border border-gray-200 p-2" value={data.title || ""} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder="e.g., Optimized build pipeline" />
        </div>
        {step === 0 && (
          <div>
            <div className="font-medium">Situation</div>
            <textarea className="w-full h-32 p-2 rounded border border-gray-200" value={data.situation || ""} onChange={(e) => setData({ ...data, situation: e.target.value })} placeholder="Context and challenge…" />
          </div>
        )}
        {step === 1 && (
          <div>
            <div className="font-medium">Task</div>
            <textarea className="w-full h-32 p-2 rounded border border-gray-200" value={data.task || ""} onChange={(e) => setData({ ...data, task: e.target.value })} placeholder="Your responsibility/goal…" />
          </div>
        )}
        {step === 2 && (
          <div>
            <div className="font-medium">Action</div>
            <textarea className="w-full h-32 p-2 rounded border border-gray-200" value={data.action || ""} onChange={(e) => setData({ ...data, action: e.target.value })} placeholder="Steps you took…" />
          </div>
        )}
        {step === 3 && (
          <div>
            <div className="font-medium">Result</div>
            <textarea className="w-full h-32 p-2 rounded border border-gray-200" value={data.result || ""} onChange={(e) => setData({ ...data, result: e.target.value })} placeholder="Outcomes and metrics…" />
          </div>
        )}
        <div className="mt-3 flex justify-between">
          <button className="px-3 py-1 rounded border" onClick={prev} disabled={step===0}>Back</button>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded border" onClick={() => setStep(0)}>1</button>
            <button className="px-3 py-1 rounded border" onClick={() => setStep(1)}>2</button>
            <button className="px-3 py-1 rounded border" onClick={() => setStep(2)}>3</button>
            <button className="px-3 py-1 rounded border" onClick={() => setStep(3)}>4</button>
          </div>
          <button className="px-3 py-1 rounded border" onClick={next} disabled={step===3}>Next</button>
        </div>
      </div>

      <div ref={previewRef} className="p-4 rounded border border-gray-200 bg-white/70 backdrop-blur">
        <div className="font-medium mb-2">Preview</div>
        {data.title && <div className="text-lg font-semibold mb-2">{data.title}</div>}
        <div className="space-y-2">
          {data.situation && <p><span className="font-medium">Situation:</span> {data.situation}</p>}
          {data.task && <p><span className="font-medium">Task:</span> {data.task}</p>}
          {data.action && <p><span className="font-medium">Action:</span> {data.action}</p>}
          {data.result && <p><span className="font-medium">Result:</span> {data.result}</p>}
        </div>
        <div className="mt-3">
          <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={exportPDF}>Export PDF</button>
        </div>
      </div>
    </div>
  );
}
