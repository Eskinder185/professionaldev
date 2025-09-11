import { useMemo, useState } from "react";
import SectionHeader from "../../components/SectionHeader";
import Card from "../../components/Card";
import { INTEREST_QUESTIONS } from "../../data/self/interests";
import { save, load } from "../../utils/storage";
import { Link } from "react-router-dom";

type Scores = { frontend: number; devops: number; cloudsec: number };

export default function CareerInterests() {
  const [answers, setAnswers] = useState<Record<string, number>>(() => load("pd:self:interests:last", {}));

  const scores = useMemo<Scores>(() => {
    let f=0,d=0,c=0, total=0;
    for (const q of INTEREST_QUESTIONS) {
      const s = answers[q.id] ?? 0;
      f += s * (q.weights.frontend || 0);
      d += s * (q.weights.devops || 0);
      c += s * (q.weights.cloudsec || 0);
      total += s * (q.weights.frontend + q.weights.devops + q.weights.cloudsec);
    }
    const norm = (x: number) => Math.round((total ? (x / (f + d + c)) : 0) * 100);
    const sum = f + d + c || 1;
    return { frontend: Math.round((f / sum) * 100), devops: Math.round((d / sum) * 100), cloudsec: Math.round((c / sum) * 100) };
  }, [answers]);

  const saveAll = () => save("pd:self:interests:last", answers);

  return (
    <div className="relative">
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 space-y-6">
        <SectionHeader title="Career Interests Map" subtitle="Short quiz to map you to role tracks." />
        <Card>
          <div className="space-y-3">
            {INTEREST_QUESTIONS.map((q) => (
              <div key={q.id} className="rounded border border-white/10 bg-white/5 p-3">
                <div className="mb-1">{q.text}</div>
                <input type="range" min={1} max={5} value={answers[q.id] ?? 3} onChange={(e)=>setAnswers({...answers, [q.id]: parseInt(e.target.value,10)})} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-1 rounded border" onClick={saveAll}>Save</button>
          </div>
        </Card>
        <Card>
          <div className="font-medium mb-2">Your role mix</div>
          {["frontend","devops","cloudsec"].map((k) => (
            <div key={k} className="mb-2">
              <div className="flex justify-between text-sm"><span className="capitalize">{k}</span><span>{(scores as any)[k]}%</span></div>
              <div className="h-2 bg-white/10 rounded"><div className="h-2 bg-blue-600 rounded" style={{ width: `${(scores as any)[k]}%` }} /></div>
            </div>
          ))}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="px-3 py-1 rounded border" to="/resources/roadmaps">Open Roadmap</Link>
            <Link className="px-3 py-1 rounded border" to="/career-tools/resume-linkedin">Open Resume Kit</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

