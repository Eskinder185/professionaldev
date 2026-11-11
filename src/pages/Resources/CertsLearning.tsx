import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
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
      let h = s.hours; const title = s.title; const id = s.id;
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
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth(); const h = canvas.height * (w / canvas.width);
    pdf.addImage(img, 'PNG', 0, 0, w, h); pdf.save('certs-plan.pdf');
  };

  return (
    <div className="relative">
      <div className="relative z-10 mx-auto max-w-6xl space-y-0 px-4 py-10">
        <PageHeader
          eyebrow="Resources"
          title="Certifications & learning planner"
          sub="Pick a path, plan by week, and track progress."
        />

        <section className="border-t border-border/70 pt-8 sm:pt-10">
          <div className="flex flex-wrap gap-2">
            {CERT_PATHS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn min-h-10 px-3 ${p.id === current.id ? "btn-primary" : "surface-muted"}`}
                onClick={() => {
                  setCurrent(p);
                  setDone(() => {
                    try {
                      return JSON.parse(localStorage.getItem(`pd:resources:certs:${p.id}:done`) || "{}");
                    } catch {
                      return {};
                    }
                  });
                }}
              >
                {p.title}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
            <label className="flex items-center gap-2">
              Hours/week
              <input
                aria-label="Hours per week"
                type="number"
                min={1}
                className="input w-24 py-1"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <span>
              Estimate: {weeks} weeks (finish by {finishBy})
            </span>
          </div>
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-border/40">
              <div className="h-full rounded-full bg-[var(--accent-blue)]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-xs text-ink-muted">Progress: {progress}%</div>
          </div>
        </section>

        <section className="border-t border-border/70 pt-8 sm:pt-10">
          <h2 className="mb-4 font-medium text-ink dark:text-white">Weekly plan</h2>
          <div ref={reportRef} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left">
                  <th className="py-2 pr-3">Week</th>
                  <th className="py-2 pr-3">Step</th>
                  <th className="py-2 pr-3">Hours</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2">Done</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-3">{row.week}</td>
                    <td className="py-2 pr-3">{row.title}</td>
                    <td className="py-2 pr-3">{row.hours}</td>
                    <td className="py-2 pr-3 capitalize">{row.type}</td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={!!done[row.stepId]}
                        onChange={(e) => setDone({ ...done, [row.stepId]: e.target.checked })}
                        aria-label={`Mark ${row.title} done`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={exportPDF}>
              Download plan as PDF
            </button>
          </div>
        </section>

        <section className="border-t border-border/70 pt-8 sm:pt-10 pb-2">
          <h2 className="mb-4 font-medium text-ink dark:text-white">Resources</h2>
          <div className="mb-3">
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => setLinks([...links, { title: "", url: "" }])}>
              Add link
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {links.map((r, i) => (
              <input
                key={i}
                className="input min-w-[200px] flex-1 py-2"
                placeholder="Title — URL"
                value={`${r.title}|${r.url}`}
                onChange={(e) => {
                  const [t, u] = e.target.value.split("|");
                  const copy = [...links];
                  copy[i] = { title: t || "", url: u || "" };
                  setLinks(copy);
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {links
              .filter((l) => l.title && l.url)
              .map((l, i) => (
                <a key={i} className="text-sm underline decoration-[var(--accent-blue)]" href={l.url} target="_blank" rel="noreferrer">
                  {l.title}
                </a>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
