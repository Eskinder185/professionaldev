import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader";
import { INTEREST_QUESTIONS } from "../../data/self/interests";
import { save, load } from "../../utils/storage";

type Scores = { frontend: number; devops: number; cloudsec: number };

const TRACK_LABELS: Record<keyof Scores, string> = {
  frontend: "Frontend & product UI",
  devops: "DevOps & delivery",
  cloudsec: "Cloud & security",
};

export default function CareerInterests() {
  const [answers, setAnswers] = useState<Record<string, number>>(() => load("pd:self:interests:last", {}));
  const [saveFeedback, setSaveFeedback] = useState<"idle" | "saved">("idle");

  const scores = useMemo<Scores>(() => {
    let f = 0,
      d = 0,
      c = 0;
    for (const q of INTEREST_QUESTIONS) {
      const s = answers[q.id] ?? 0;
      f += s * (q.weights.frontend || 0);
      d += s * (q.weights.devops || 0);
      c += s * (q.weights.cloudsec || 0);
    }
    const sum = f + d + c || 1;
    return {
      frontend: Math.round((f / sum) * 100),
      devops: Math.round((d / sum) * 100),
      cloudsec: Math.round((c / sum) * 100),
    };
  }, [answers]);

  const adjustedCount = INTEREST_QUESTIONS.filter((q) => answers[q.id] != null).length;

  const saveAll = () => {
    save("pd:self:interests:last", answers);
    setSaveFeedback("saved");
    window.setTimeout(() => setSaveFeedback("idle"), 2500);
  };

  return (
    <div className="space-y-8 pb-6">
      <PageHeader
        eyebrow="Self-assessment"
        title="Career Interests Map"
        sub="Slide each statement from 1 (not me) to 5 (strongly me). We’ll estimate how your interests lean across three tracks — a guide, not a verdict. Data stays in your browser until you save."
      />

      <section className="space-y-6 border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-title-sm text-ink dark:text-white">Interest check-in</h2>
            <p className="mt-1 text-sm text-ink-muted">
              1 = low fit · 3 = neutral · 5 = strong fit. There are no wrong answers.
            </p>
          </div>
          <p className="text-caption text-ink-faint">
            {adjustedCount}/{INTEREST_QUESTIONS.length} sliders customized
          </p>
        </div>

        <div className="space-y-5">
          {INTEREST_QUESTIONS.map((q) => {
            const v = answers[q.id] ?? 3;
            return (
              <div
                key={q.id}
                className="border-b border-black/[0.06] py-4 dark:border-white/10"
              >
                <div className="mb-3 text-sm font-medium text-ink dark:text-white">{q.text}</div>
                <div className="flex flex-wrap items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={v}
                    className="min-h-11 flex-1 accent-[rgb(var(--tw-accent))]"
                    aria-valuemin={1}
                    aria-valuemax={5}
                    aria-valuenow={v}
                    aria-label={`Interest level for: ${q.text}`}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: parseInt(e.target.value, 10) })}
                  />
                  <div className="flex w-28 shrink-0 justify-between text-caption text-ink-muted">
                    <span>1</span>
                    <span className="font-semibold tabular-nums text-ink dark:text-white">{v}</span>
                    <span>5</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-black/[0.06] pt-6 dark:border-white/10">
          <button type="button" className="btn btn-primary min-h-11 px-6" onClick={saveAll}>
            Save responses
          </button>
          {saveFeedback === "saved" ? (
            <span className="text-sm font-medium text-accent" role="status">
              Saved locally
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-6 border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <div>
          <h2 className="text-title-sm text-ink dark:text-white">Your role mix</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Percentages show relative emphasis across the three tracks based on your sliders.
          </p>
        </div>

        {adjustedCount === 0 ? (
          <p className="border-b border-dashed border-black/[0.1] py-3 text-sm text-ink-muted dark:border-white/12">
            Sliders default to 3 until you move them. Adjust each one so the percentages match how you actually feel.
          </p>
        ) : null}

        <div className="space-y-4">
          {(["frontend", "devops", "cloudsec"] as const).map((k) => (
            <div key={k}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium text-ink dark:text-white">{TRACK_LABELS[k]}</span>
                <span className="tabular-nums text-ink-muted">{scores[k]}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[rgb(var(--tw-accent))] transition-[width] duration-300 ease-out"
                  style={{ width: `${scores[k]}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-black/[0.06] pt-6 dark:border-white/10">
          <Link to="/resources/roadmaps" className="btn btn-primary min-h-11 px-5">
            Open roadmaps
          </Link>
          <Link to="/career-tools/resume-grader" className="btn surface-muted min-h-11 px-5">
            Résumé grader
          </Link>
          <Link to="/career-tools/linkedin" className="btn surface-muted min-h-11 px-5">
            LinkedIn guide
          </Link>
        </div>
      </section>
    </div>
  );
}
