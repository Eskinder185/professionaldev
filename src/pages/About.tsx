import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

type Stage = "discover" | "build" | "grow";

const STAGES: Record<
  Stage,
  {
    title: string;
    blurb: string;
    links: { label: string; to: string }[];
    checklist: string[];
    meta: string;
  }
> = {
  discover: {
    title: "Discover",
    meta: "Path & fit",
    blurb:
      "Before you optimize a résumé, you need a target worth proving. Discover uses strengths, values, and interests so you choose a path that fits how you work—not a title you saw on a list. That choice becomes the lens for every artifact you build next.",
    links: [{ label: "Open Self-Assessment", to: "/self-assessment" }],
    checklist: [
      "Finish one strengths or values module and capture your top 3 signals",
      "Name 1–2 role families that match those signals (e.g., frontend, cloud, security)",
      "Write one line: the proof you’ll need next for those roles",
    ],
  },
  build: {
    title: "Build",
    meta: "Artifacts",
    blurb:
      "Skills only count when they show up as proof: a résumé that survives ATS, a LinkedIn and GitHub surface that passes a skim, projects and READMEs that demonstrate ownership, and STAR answers that hold up in structured interviews. Build is where effort becomes verifiable output.",
    links: [{ label: "Open Career Tools", to: "/career-tools" }],
    checklist: [
      "Run the résumé grader and address the highest-impact fixes first",
      "Ship one portfolio or GitHub upgrade someone can validate in under a minute",
      "Lock two STAR stories with at least one metric each",
    ],
  },
  grow: {
    title: "Grow",
    meta: "Systems & momentum",
    blurb:
      "Offers come from sustained execution: certification roadmaps, repeatable job-search habits, application and skill tracking, referrals, and iteration after every screen. Grow is the operating layer—so you’re not starting from zero each week.",
    links: [{ label: "Open Resources", to: "/resources" }],
    checklist: [
      "Choose a cert or learning roadmap and block weekly hours on the calendar",
      "Use trackers to log applications, next actions, and practice time",
      "Add one referral or intentional networking step to your pipeline",
    ],
  },
};

const FAQ_ITEMS = [
  {
    q: "What should I do first?",
    a: "Start in Discover if your target role still feels fuzzy—one pass through strengths, values, or interests gives you a defensible direction. If you already know the role, go straight to Build and fix the highest-leverage artifact (usually résumé or LinkedIn), then use Grow to run applications and learning on a schedule. The loop is repeatable whenever you pivot.",
  },
  {
    q: "Why does this site focus so much on proof?",
    a: "Hiring decisions are made from evidence, not intention. Recruiters and managers rarely infer potential from study notes—they scan files, profiles, repos, and interview answers. This platform is structured so each phase produces something that can survive ATS parsing, a short human skim, and behavioral questions. Proof is the interface between you and an offer.",
  },
  {
    q: "Do I need certifications first?",
    a: "Not necessarily. Certs help when they close a credibility gap for a specific path (e.g., cloud or security). Many candidates should pair a lean cert plan with strong Build outputs—résumé, projects, stories—so credentials support proof instead of replacing it. Use Grow’s roadmaps when a cert clearly moves your target role forward.",
  },
  {
    q: "How do I know I’m progressing?",
    a: "Progress shows up as concrete deltas: a higher résumé score, clearer LinkedIn and GitHub signals, more rehearsed stories, logged applications, and follow-through on next actions. If those outputs aren’t moving, you’re still in intention territory—tighten one artifact or one weekly habit until the evidence improves.",
  },
] as const;

const CHECKLIST_STORAGE_VER = "v4";

export default function About() {
  const [stage, setStage] = useState<Stage>(() => (localStorage.getItem("pd:about:stage3") as Stage) || "discover");
  useEffect(() => localStorage.setItem("pd:about:stage3", stage), [stage]);
  const s = STAGES[stage];

  return (
    <div className="pb-20 sm:pb-24">
      <header className="mb-16 sm:mb-20">
        <p className="section-label">About</p>
        <h1 className="mt-4 max-w-3xl text-balance text-title font-semibold tracking-tight text-ink dark:text-white sm:text-4xl sm:leading-[1.08]">
          A system for turning effort into hireable proof
        </h1>
        <p className="section-plain mt-6 max-w-2xl text-body leading-relaxed text-ink-muted sm:mt-7 sm:text-lead">
          This platform is built around one reality:{" "}
          <span className="font-medium text-ink dark:text-white">
            hiring decisions are made from evidence, not intention.
          </span>{" "}
          You don’t move through random tips—you follow a structured loop where each step creates output that can survive ATS parsing, recruiter skim time, and structured interviews.
        </p>
        <p className="section-plain mt-5 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem] sm:leading-relaxed">
          <span className="font-medium text-ink dark:text-white">Discover</span>,{" "}
          <span className="font-medium text-ink dark:text-white">Build</span>, and{" "}
          <span className="font-medium text-ink dark:text-white">Grow</span> are how we organize that work: choose
          fit, ship artifacts, then run the search and learning system that compounds—without pretending that
          passive learning alone closes the gap to an offer.
        </p>
      </header>

      <section className="mb-16 sm:mb-20" aria-labelledby="about-stage-label">
        <h2
          id="about-stage-label"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted"
        >
          Where you are now
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          <span className="font-medium text-ink dark:text-white">Discover</span> — choose a path from strengths,
          values, and interests. <span className="font-medium text-ink dark:text-white">Build</span> — turn skills
          into proof artifacts. <span className="font-medium text-ink dark:text-white">Grow</span> — apply, refine,
          track, and sustain momentum. Select the phase that matches today’s bottleneck.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {(["discover", "build", "grow"] as Stage[]).map((id) => (
            <button
              key={id}
              type="button"
              className={
                stage === id
                  ? "btn btn-primary min-h-10 px-5"
                  : "btn surface-muted min-h-10 border-transparent bg-transparent px-5 dark:bg-transparent"
              }
              onClick={() => setStage(id)}
              aria-pressed={stage === id}
            >
              {STAGES[id].title}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-16 sm:mb-20" aria-labelledby="about-focus-heading">
        <div className="flex flex-col gap-1 border-t border-black/[0.07] pt-10 dark:border-white/[0.09] sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <h2
            id="about-focus-heading"
            className="text-2xl font-semibold tracking-tight text-ink dark:text-white sm:text-[1.65rem]"
          >
            {s.title}
          </h2>
          <p className="shrink-0 text-caption font-medium tracking-wide text-ink-faint">{s.meta}</p>
        </div>
        <p className="section-plain mt-8 max-w-2xl text-body leading-relaxed text-ink-muted">{s.blurb}</p>
        <div className="mt-10">
          {s.links.map((l) => (
            <Link key={l.to} to={l.to} className="btn btn-primary min-h-11 px-6">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="mt-14 border-t border-black/[0.07] pt-10 dark:border-white/[0.09] sm:mt-16 sm:pt-12">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            This week
          </h3>
          <p className="mt-2 max-w-xl text-caption leading-relaxed text-ink-faint">
            Light checkpoints—tick them off as you ship proof, not as busywork.
          </p>
          <Checklist key={stage} stage={stage} />
        </div>
      </section>

      <section className="border-t border-black/[0.07] pt-14 dark:border-white/[0.09] sm:pt-16" aria-labelledby="about-faq-heading">
        <h2 id="about-faq-heading" className="text-2xl font-semibold tracking-tight text-ink dark:text-white">
          Frequently asked questions
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Short answers aligned with how the product is meant to be used.
        </p>
        <div className="mt-10 max-w-2xl border-t border-black/[0.07] pt-2 dark:border-white/[0.09]">
          {FAQ_ITEMS.map(({ q, a }) => (
            <FAQItem key={q} q={q} a={a} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Checklist({ stage }: { stage: Stage }) {
  const key = `pd:about:${stage}:check:${CHECKLIST_STORAGE_VER}`;
  const defaults = STAGES[stage].checklist;
  const [state, setState] = useState<boolean[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(raw) || raw.length !== defaults.length) return defaults.map(() => false);
      return raw;
    } catch {
      return defaults.map(() => false);
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return (
    <ul className="mt-6 space-y-0" role="list">
      {defaults.map((label, i) => (
        <li
          key={label}
          className="flex items-start gap-3 border-b border-black/[0.06] py-4 last:border-b-0 dark:border-white/[0.08]"
        >
          <input
            type="checkbox"
            id={`about-check-${stage}-${i}`}
            className="mt-1 h-4 w-4 shrink-0 rounded border-black/20 accent-[rgb(var(--tw-accent))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] dark:border-white/25"
            checked={!!state[i]}
            onChange={(e) => {
              const n = [...state];
              n[i] = e.target.checked;
              setState(n);
            }}
            aria-label={label}
          />
          <label
            htmlFor={`about-check-${stage}-${i}`}
            className={`cursor-pointer text-sm leading-relaxed text-ink dark:text-white/95 ${state[i] ? "text-ink-muted line-through dark:text-ink-muted" : ""}`}
          >
            {label}
          </label>
        </li>
      ))}
    </ul>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-black/[0.06] last:border-b-0 dark:border-white/[0.08]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-left marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-base font-medium leading-snug text-ink dark:text-white">{q}</span>
        <ChevronDown
          className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <p className="section-plain max-w-prose pb-6 text-sm leading-relaxed text-ink-muted">{a}</p>
    </details>
  );
}
