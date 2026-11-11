import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader";
import { STRENGTHS_QUESTIONS, Likert, Q } from "../../data/self/strengthsQuestions";
import { save, load } from "../../utils/storage";

type Scores = { focus: number; communication: number; ownership: number; pace: number };
const TRAITS: (keyof Scores)[] = ["focus", "communication", "ownership", "pace"];

export default function StrengthsTest() {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, Likert>>(() => load("pd:self:strengths:answers", {}));
  const reportRef = useRef<HTMLDivElement>(null);

  const pages = Math.ceil(STRENGTHS_QUESTIONS.length / 5);
  const [page, setPage] = useState(0);

  const computeResults = (): Scores => {
    const sums: Record<string, { total: number; count: number }> = {};
    for (const t of TRAITS) sums[t] = { total: 0, count: 0 };
    for (const q of STRENGTHS_QUESTIONS) {
      const v = answers[q.id];
      if (!v) continue;
      const val = q.reverse ? (6 - v) : v;
      sums[q.trait].total += val;
      sums[q.trait].count += 1;
    }
    const out: any = {};
    for (const t of TRAITS) {
      const { total, count } = sums[t];
      out[t] = count ? Math.round((total / count) * 10) / 10 : 0;
    }
    return out as Scores;
  };

  const results = useMemo(computeResults, [answers]);
  const chartData = TRAITS.map((t) => ({ trait: t, score: results[t] }));

  const topStrengths = [...TRAITS].sort((a, b) => results[b] - results[a]).slice(0, 3);
  const blindSpots = [...TRAITS].sort((a, b) => results[a] - results[b]).slice(0, 3);

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
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
      <div className="relative z-10 mx-auto max-w-5xl space-y-0 px-4 py-10">
        <PageHeader
          eyebrow="Self assessment"
          title="Strengths & weaknesses test"
          sub="20 questions · ~10–15 minutes · stored locally only"
        />

        {step === 1 && (
          <section className="border-t border-border/70 pt-8 sm:pt-10">
            <p className="text-body text-ink-muted">
              This quick test measures four work traits: Focus, Communication, Ownership, and Pace. Your data stays on your device. When ready, start the quiz.
            </p>
            <div className="mt-4">
              <button type="button" className="btn btn-primary min-h-10 px-4" onClick={() => setStep(2)}>
                Start
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="border-t border-border/70 pt-8 sm:pt-10">
            <div className="mb-6 flex items-center justify-between">
              <div className="font-medium text-ink dark:text-white">
                Questions {page * 5 + 1}–{Math.min(page * 5 + 5, STRENGTHS_QUESTIONS.length)}
              </div>
              <div className="text-sm text-ink-muted">
                Page {page + 1} / {pages}
              </div>
            </div>
            <div className="divide-y divide-border/60 border-t border-border/60">
              {pageQs.map((q) => (
                <div key={q.id} className="py-5">
                  <div className="mb-2 text-ink dark:text-white">{q.text}</div>
                  <div className="flex flex-wrap gap-4">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <label key={v} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={q.id}
                          value={v}
                          checked={answers[q.id] === v}
                          onChange={() => setAnswers({ ...answers, [q.id]: v as Likert })}
                        />
                        <span>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-between gap-4">
              <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Back
              </button>
              {page < pages - 1 ? (
                <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>
                  Next
                </button>
              ) : (
                <button type="button" className="btn btn-primary min-h-10 px-4" onClick={() => setStep(3)}>
                  Finish
                </button>
              )}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="border-t border-border/70 pt-8 sm:pt-10">
            <div ref={reportRef} className="space-y-6">
              <div className="flex h-72 w-full items-center justify-center rounded-lg bg-white dark:bg-white/5">
                <RadarLite data={chartData} max={5} />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="font-medium text-ink dark:text-white">Top strengths</div>
                  <ul className="mt-2 list-disc pl-5 text-ink-muted">
                    {topStrengths.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-ink dark:text-white">Blind spots</div>
                  <ul className="mt-2 list-disc pl-5 text-ink-muted">
                    {blindSpots.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn surface-muted min-h-10 px-4" onClick={saveResult}>
                  Save
                </button>
                <button type="button" className="btn surface-muted min-h-10 px-4" onClick={exportPDF}>
                  Download PDF summary
                </button>
              </div>
              <div className="surface-emphasis border-l-4 border-l-[var(--accent-blue)] p-4">
                <div className="mb-1 font-medium text-ink dark:text-white">What to do next</div>
                <p className="text-sm text-ink-muted">Check the role roadmaps that align with your strengths.</p>
                <a className="mt-2 inline-block text-sm underline decoration-[var(--accent-blue)]" href="/resources/roadmaps">
                  Open Roadmap →
                </a>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <Link className="underline decoration-[var(--accent-blue)]" to="/resources/roadmaps">
                  Open Roadmap →
                </Link>
                <Link className="underline decoration-[var(--accent-blue)]" to="/career-tools/elevator-studio">
                  Practice in Elevator Studio →
                </Link>
              </div>
            </div>
          </section>
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
