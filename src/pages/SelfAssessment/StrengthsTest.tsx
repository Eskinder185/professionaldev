import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeader from "../../components/SectionHeader";
import Card from "../../components/Card";
import { STRENGTHS_QUESTIONS, Likert, Q } from "../../data/self/strengthsQuestions";
import { save, load } from "../../utils/storage";

type Scores = { focus: number; communication: number; ownership: number; pace: number };

export default function StrengthsTest() {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, Likert>>(() => load("pd:self:strengths:answers", {}));
  const reportRef = useRef<HTMLDivElement>(null);

  const pages = Math.ceil(STRENGTHS_QUESTIONS.length / 5);
  const [page, setPage] = useState(0);

  const traits: (keyof Scores)[] = ["focus", "communication", "ownership", "pace"];

  const computeResults = (): Scores => {
    const sums: Record<string, { total: number; count: number }> = {};
    for (const t of traits) sums[t] = { total: 0, count: 0 };
    for (const q of STRENGTHS_QUESTIONS) {
      const v = answers[q.id];
      if (!v) continue;
      const val = q.reverse ? (6 - v) : v;
      sums[q.trait].total += val;
      sums[q.trait].count += 1;
    }
    const out: any = {};
    for (const t of traits) {
      const { total, count } = sums[t];
      out[t] = count ? Math.round((total / count) * 10) / 10 : 0;
    }
    return out as Scores;
  };

  const results = useMemo(computeResults, [answers]);
  const chartData = traits.map((t) => ({ trait: t, score: results[t] }));

  const topStrengths = [...traits].sort((a, b) => results[b] - results[a]).slice(0, 3);
  const blindSpots = [...traits].sort((a, b) => results[a] - results[b]).slice(0, 3);

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
    const pageWidth = pdf.internal.pageSize.getWidth();
    const ratio = pageWidth / canvas.width; const w = pageWidth; const h = canvas.height * ratio;
    pdf.addImage(img, 'PNG', 0, 0, w, h);
    pdf.save('strengths-summary.pdf');
  };

  const saveResult = () => {
    const last = { date: new Date().toISOString(), results };
    save("pd:self:strengths:last", last);
    const history = load<any[]>("pd:self:strengths:history", []);
    save("pd:self:strengths:history", [last, ...history].slice(0, 10));
    save("pd:self:strengths:answers", answers);
  };

  const pageQs: Q[] = STRENGTHS_QUESTIONS.slice(page * 5, page * 5 + 5);

  return (
    <div className="relative">
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 space-y-6">
        <SectionHeader title="Strengths & Weaknesses Test" subtitle="20 questions · ~10–15 minutes · stored locally only" />

        {step === 1 && (
          <Card>
            <p className="text-white/80">This quick test measures four work traits: Focus, Communication, Ownership, and Pace. Your data stays on your device. When ready, start the quiz.</p>
            <div className="mt-3">
              <button className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={() => setStep(2)}>Start</button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Questions {page * 5 + 1}–{Math.min(page * 5 + 5, STRENGTHS_QUESTIONS.length)}</div>
              <div className="text-sm text-white/70">Page {page + 1} / {pages}</div>
            </div>
            <div className="space-y-4">
              {pageQs.map((q) => (
                <div key={q.id} className="bg-white/5 rounded p-3 border border-white/10">
                  <div className="mb-2">{q.text}</div>
                  <div className="flex gap-3">
                    {[1,2,3,4,5].map((v) => (
                      <label key={v} className="inline-flex items-center gap-1">
                        <input type="radio" name={q.id} value={v} checked={answers[q.id] === v}
                          onChange={() => setAnswers({ ...answers, [q.id]: v as Likert })} />
                        <span className="text-sm">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <button className="px-3 py-1 rounded border" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page===0}>Back</button>
              {page < pages - 1 ? (
                <button className="px-3 py-1 rounded border" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</button>
              ) : (
                <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={() => setStep(3)}>Finish</button>
              )}
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <div ref={reportRef} className="space-y-4">
              <div className="h-72 w-full bg-white rounded flex items-center justify-center">
                <RadarLite data={chartData} max={5} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="font-medium">Top strengths</div>
                  <ul className="list-disc pl-5">
                    {topStrengths.map((t) => (<li key={t}>{t}</li>))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Blind spots</div>
                  <ul className="list-disc pl-5">
                    {blindSpots.map((t) => (<li key={t}>{t}</li>))}
                  </ul>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded border" onClick={saveResult}>Save</button>
                <button className="px-3 py-1 rounded border" onClick={exportPDF}>Download PDF summary</button>
              </div>
              <div className="p-3 rounded border border-white/10 bg-white/5">
                <div className="font-medium mb-1">What to do next</div>
                <p className="text-sm">Check the role roadmaps that align with your strengths.</p>
                <a className="text-blue-400 underline" href="/resources/roadmaps">Open Roadmap →</a>
              </div>
              <div className="mt-2 text-sm">
                <div className="flex gap-2">
                  <Link className="text-blue-400 underline" to="/resources/roadmaps">Open Roadmap →</Link>
                  <Link className="text-blue-400 underline" to="/career/speech-studio">Practice in Speech Studio →</Link>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function RadarLite({ data, max }: { data: { trait: string; score: number }[]; max: number }) {
  const cx = 150, cy = 150, r = 110;
  const angle = (i: number) => (Math.PI * 2 * i) / data.length - Math.PI / 2;
  const pt = (i: number, value: number) => [
    cx + Math.cos(angle(i)) * (r * (value / max)),
    cy + Math.sin(angle(i)) * (r * (value / max)),
  ];
  const polygon = data.map((d, i) => pt(i, d.score).join(",")).join(" ");
  const spokes = data.map((d, i) => pt(i, max));
  return (
    <svg viewBox="0 0 300 300" className="max-w-full max-h-full">
      <circle cx={cx} cy={cy} r={r} fill="#93c5fd" fillOpacity="0.15" stroke="#e5e7eb" />
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <circle key={f} cx={cx} cy={cy} r={r * f} fill="none" stroke="#e5e7eb" />
      ))}
      {spokes.map(([x, y], i) => (
        <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" />
      ))}
      <polygon points={polygon} fill="#60a5fa" fillOpacity="0.5" stroke="#2563eb" />
      {data.map((d, i) => {
        const [x, y] = pt(i, max + 0.2);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#111827">
            {d.trait}
          </text>
        );
      })}
    </svg>
  );
}
