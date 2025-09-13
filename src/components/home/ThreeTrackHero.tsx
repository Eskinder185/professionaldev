import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Stop = {
  id: "discover" | "build" | "grow";
  title: string;
  sub: string;
  cta: { label: string; to: string };
};

const STOPS: Stop[] = [
  {
    id: "discover",
    title: "Discover",
    sub: "Find strengths, values, and interests so choices fit you.",
    cta: { label: "Open Self-Assessment", to: "/SelfAssessment" },
  },
  {
    id: "build",
    title: "Build",
    sub: "Polish résumé & LinkedIn, practice interviews, ship portfolio.",
    cta: { label: "Open Career Tools", to: "/CareerTools" },
  },
  {
    id: "grow",
    title: "Grow",
    sub: "Roadmaps, trackers, and weekly plans to keep momentum.",
    cta: { label: "Open Resources", to: "/Resources" },
  },
];

export default function ThreeTrackHero() {
  const [active, setActive] = useState<Stop["id"]>("discover");
  const wrapRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const id = e.target.getAttribute("data-id") as Stop["id"];
          if (e.isIntersecting) setActive(id);
        });
      },
      { root, threshold: 0.6 }
    );
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const idx = useMemo(() => STOPS.findIndex((s) => s.id === active), [active]);

  return (
    <section className="surface p-5 rounded-2xl hover-glow">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold brand-heading">Roadmap (3 steps)</h2>
          <p className="opacity-80">Scroll or tap a stop. The ribbon animates as you move.</p>
        </div>
        <div className="hidden md:flex gap-2">
          {STOPS.map((s, i) => (
            <button
              key={s.id}
              className={`chip ${active === s.id ? "!border-[var(--accent-pink)]" : ""}`}
              onClick={() =>
                refs.current[s.id]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
              }
              aria-label={`Go to ${s.title}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-6 relative">
        {/* desktop animated ribbon */}
        <svg
          className="hidden md:block absolute inset-x-0 top-12 h-36 w-full pointer-events-none"
          viewBox="0 0 1200 160"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="heroGrad" x1="0" x2="1">
              <stop offset="0%" stopColor="var(--accent-violet)" />
              <stop offset="100%" stopColor="var(--accent-pink)" />
            </linearGradient>
          </defs>
        <path
            d="M60,120 C280,20 420,20 600,120 C780,220 920,220 1140,120"
            fill="none"
            stroke="url(#heroGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            className="animate-ribbon"
            opacity="0.6"
          />
        </svg>

        {/* stops (scroll-snap; vertical on mobile, horizontal on md+) */}
        <div
          ref={wrapRef}
          className="roadmap-snap mt-2 flex md:flex-row flex-col gap-4 md:overflow-x-auto md:pb-2"
        >
          {STOPS.map((s, i) => (
            <div
              key={s.id}
              data-id={s.id}
              ref={(el) => (refs.current[s.id] = el)}
              className="snap-center shrink-0 md:w-[min(520px,80%)] w-full"
            >
              <article
                className={`surface-muted rounded-2xl p-5 transition-transform duration-200 ${
                  active === s.id ? "ring-1 ring-[var(--accent-pink)] scale-[1.01]" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`dot ${i <= idx ? "dot-on" : ""}`} aria-hidden />
                  <div>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="text-sm opacity-85">{s.sub}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Link to={s.cta.to} className="btn btn-anim btn-pink">
                    {s.cta.label}
                  </Link>
                  <span className="text-xs opacity-70">
                    Step {i + 1} of {STOPS.length}
                  </span>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
