import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
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
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
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
      <div className="relative z-10 mx-auto max-w-5xl space-y-0 px-4 py-10">
        <PageHeader
          eyebrow="Career Tools"
          title="STAR method practice tool"
          sub="Guided steps with timer, cleanup, and export."
        />

        <section className="border-t border-border/70 pt-8 sm:pt-10">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={timerOn}
                onChange={(e) => {
                  setTimerOn(e.target.checked);
                  if (!e.target.checked) setSeconds(0);
                }}
              />{" "}
              Timer
            </label>
            {timerOn && (
              <div className="text-sm font-medium text-ink dark:text-white">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </div>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                className="btn surface-muted min-h-9 px-3 text-sm"
                onClick={() => setDraft({ ...draft, tightened: !draft.tightened })}
                aria-pressed={!!draft.tightened}
              >
                Tighten
              </button>
              <select
                className="input min-h-9 py-1 text-sm"
                onChange={(e) => {
                  const p = presets[e.target.value];
                  if (p) setDraft({ ...draft, ...p });
                }}
              >
                <option value="">Load scenario…</option>
                <option value="leadership">Leadership</option>
                <option value="conflict">Conflict</option>
                <option value="failure">Failure</option>
              </select>
            </div>
          </div>
        </section>

        {["Situation", "Task", "Action", "Result"].map((label, i) => (
          <section key={label} className="border-t border-border/70 pt-8 sm:pt-10">
            <h2 className="mb-3 font-medium text-ink dark:text-white">{label}</h2>
            <textarea
              aria-label={label}
              className="textarea min-h-28 w-full"
              value={(draft as any)[label.toLowerCase()]}
              onChange={(e) => setDraft({ ...draft, [label.toLowerCase()]: e.target.value })}
            />
            <div className="mt-2 text-xs text-ink-muted">
              {((draft as any)[label.toLowerCase()] || "").split(/\s+/).filter(Boolean).length} words
            </div>
            <div className="mt-4 flex justify-between gap-4">
              <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => setStep(Math.max(0, step - 1))} disabled={i === 0}>
                Back
              </button>
              <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => setStep(Math.min(3, step + 1))} disabled={i === 3}>
                Next
              </button>
            </div>
          </section>
        ))}

        <section className="border-t border-border/70 pt-8 sm:pt-10">
          <div ref={reportRef}>
            <h2 className="mb-3 font-medium text-ink dark:text-white">STAR story</h2>
            <p className="whitespace-pre-wrap text-body text-ink-muted">{tightenedText}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={saveStory}>
              Save
            </button>
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => navigator.clipboard?.writeText(tightenedText)}>
              Copy
            </button>
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={exportPDF}>
              Export PDF
            </button>
          </div>
        </section>

        {library.length > 0 && (
          <section className="border-t border-border/70 pt-8 sm:pt-10 pb-2">
            <h2 className="mb-3 font-medium text-ink dark:text-white">Saved stories</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {library.map((s) => (
                <li key={s.id}>
                  <span className="mr-2 text-ink-muted/80">{new Date(s.date).toLocaleString()}:</span>
                  {(s.situation + " " + s.task).slice(0, 80)}…
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
