import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import { CORE_VALUES } from "../../data/self/coreValues";
import { load, save } from "../../utils/storage";

type Item = { value: string; rank: number };

const REFLECTION_PROMPTS = [
  "When have you felt most energized at work?",
  "What trade-off are you unwilling to make?",
  "What environment makes you do your best work?",
] as const;

export default function CoreValues() {
  const [items, setItems] = useState<Item[]>(() => {
    const saved = load<Item[]>("pd:self:values:rank", []);
    if (saved.length) return saved;
    return CORE_VALUES.map((v, i) => ({ value: v, rank: i + 1 }));
  });
  const legacyNotes = load("pd:self:values:notes", "");
  const [notes1, setNotes1] = useState(() => load("pd:self:values:notes1", legacyNotes));
  const [notes2, setNotes2] = useState(() => load("pd:self:values:notes2", ""));
  const [notes3, setNotes3] = useState(() => load("pd:self:values:notes3", ""));
  const ref = useRef<HTMLDivElement>(null);
  const [saveFeedback, setSaveFeedback] = useState<"idle" | "saved">("idle");
  const [exporting, setExporting] = useState(false);

  const move = (idx: number, dir: -1 | 1) => {
    const copy = [...items];
    const j = idx + dir;
    if (j < 0 || j >= copy.length) return;
    const tmp = copy[idx];
    copy[idx] = copy[j];
    copy[j] = tmp;
    copy.forEach((v, i) => (v.rank = i + 1));
    setItems(copy);
  };

  const statement = useMemo(() => {
    const top = items.slice(0, 3).map((i) => i.value);
    if (top.length < 3) return "";
    return `I thrive in roles prioritizing ${top[0]}, ${top[1]}, and ${top[2]}; I avoid roles that undermine these.`;
  }, [items]);

  const exportPDF = async () => {
    setExporting(true);
    try {
      const jspdfName = "jspdf";
      const html2canvasName = "html2canvas";
      const [{ jsPDF }, html2canvas] = await Promise.all([
        import(/* @vite-ignore */ jspdfName as any),
        import(/* @vite-ignore */ html2canvasName as any),
      ]);
      const el = ref.current;
      if (!el) return;
      const canvas = await (html2canvas as any).default(el, { scale: 2, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/png");
      const pdf = new (jsPDF as any)({ unit: "pt", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = canvas.height * (w / canvas.width);
      pdf.addImage(img, "PNG", 0, 0, w, h);
      pdf.save("core-values.pdf");
    } finally {
      setExporting(false);
    }
  };

  const saveAll = () => {
    save("pd:self:values:rank", items);
    save("pd:self:values:notes1", notes1);
    save("pd:self:values:notes2", notes2);
    save("pd:self:values:notes3", notes3);
    save("pd:self:values:notes", notes1);
    setSaveFeedback("saved");
    window.setTimeout(() => setSaveFeedback("idle"), 2500);
  };

  const notesSetters = [setNotes1, setNotes2, setNotes3] as const;
  const notesVals = [notes1, notes2, notes3] as const;

  return (
    <div className="space-y-8 pb-6">
      <PageHeader
        eyebrow="Self-assessment"
        title="Core Values Workshop"
        sub="Reorder the list to reflect what matters most, jot quick reflections, then use your generated filter when you read job posts or prep for interviews. Everything saves in this browser."
      />

      <section className="space-y-6 border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <div>
          <h2 className="text-title-sm text-ink dark:text-white">Rank your values</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Top of the list = highest priority. Use the arrows or keyboard when a row is focused (↑/↓).
          </p>
        </div>
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={it.value}
              className="flex items-center justify-between gap-3 border-b border-black/[0.06] py-3 dark:border-white/10"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-7 shrink-0 text-center text-sm font-medium text-ink-muted">{idx + 1}</span>
                <span className="text-sm text-ink dark:text-white">{it.value}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="btn surface-muted min-h-9 min-w-9 p-0"
                  aria-label="Move up"
                  onClick={() => move(idx, -1)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      move(idx, -1);
                    }
                  }}
                >
                  <ArrowUp className="mx-auto h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn surface-muted min-h-9 min-w-9 p-0"
                  aria-label="Move down"
                  onClick={() => move(idx, 1)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      move(idx, 1);
                    }
                  }}
                >
                  <ArrowDown className="mx-auto h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-6 border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <div>
          <h2 className="text-title-sm text-ink dark:text-white">Reflection prompts</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Short notes are enough — they’re for you, not a polished essay. Each prompt has its own field.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {REFLECTION_PROMPTS.map((q, i) => (
            <div key={i} className="space-y-2">
              <label htmlFor={`values-reflect-${i}`} className="block text-sm font-medium text-ink dark:text-white">
                Prompt {i + 1}
              </label>
              <p className="text-caption text-ink-muted">{q}</p>
              <textarea
                id={`values-reflect-${i}`}
                className="textarea min-h-[7rem]"
                placeholder="A sentence or two…"
                value={notesVals[i]}
                onChange={(e) => notesSetters[i](e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6 border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <div>
          <h2 className="text-title-sm text-ink dark:text-white">My job filter</h2>
          <p className="mt-1 text-sm text-ink-muted">
            A one-line statement from your top three values, plus the full ranked list for reference.
          </p>
        </div>

        <div ref={ref} className="border-l-2 border-accent/35 py-2 pl-4">
          {!statement ? (
            <EmptyState
              className="min-h-0 border-0 bg-transparent py-8 dark:bg-transparent"
              title="Your one-line filter will appear here"
              hint="It’s built from the top three values in your ranked list."
            />
          ) : (
            <p className="text-body font-medium leading-relaxed text-ink dark:text-white">{statement}</p>
          )}
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink dark:text-white/90">
            {items.map((i) => (
              <li key={i.value}>{i.value}</li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-3 border-t border-black/[0.06] pt-6 dark:border-white/10 sm:flex-row sm:items-center">
          <button type="button" className="btn btn-primary min-h-11 px-6" onClick={saveAll}>
            Save to this browser
          </button>
          <button
            type="button"
            className="btn surface-muted min-h-11 px-6"
            onClick={exportPDF}
            disabled={exporting}
          >
            {exporting ? "Preparing PDF…" : "Export PDF"}
          </button>
          {saveFeedback === "saved" ? (
            <span className="text-sm font-medium text-accent" role="status">
              Saved
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
