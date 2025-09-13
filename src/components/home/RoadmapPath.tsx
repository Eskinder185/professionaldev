import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Stop = {
  id: "assess" | "plan" | "act" | "reflect";
  title: string;
  sub: string;
  cta: { label: string; to: string };
};

const STOPS: Stop[] = [
  {
    id: "assess",
    title: "Self-Assess",
    sub: "Strengths, values, interests, blind spots.",
    cta: { label: "Open self-assessment", to: "/SelfAssessment" },
  },
  {
    id: "plan",
    title: "Plan",
    sub: "Choose a track, set tiny weekly goals.",
    cta: { label: "Open resources", to: "/Resources/Certs" },
  },
  {
    id: "act",
    title: "Act",
    sub: "Polish résumé & LinkedIn, ship portfolio, practice.",
    cta: { label: "Open career tools", to: "/CareerTools" },
  },
  {
    id: "reflect",
    title: "Reflect",
    sub: "Prompts, streaks, focus — iterate small.",
    cta: { label: "Open motivation", to: "/Motivation" },
  },
];

export default function RoadmapPath() {
  const [active, setActive] = useState<Stop["id"]>("assess");
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Activate stop when it's centered (scroll-snap + observer)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          const id = e.target.getAttribute("data-id") as Stop["id"];
          if (e.isIntersecting && id) setActive(id);
        });
      },
      { root: wrap, threshold: 0.6 }
    );
    Object.values(itemRefs.current).forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const idx = useMemo(() => STOPS.findIndex(s => s.id === active), [active]);

  return (
    <section className="surface p-5 rounded-2xl hover-glow">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold brand-heading">Your Roadmap</h2>
          <p className="opacity-80">Scroll through the stages — tap a stop to open the right tool.</p>
        </div>
        <div className="hidden md:flex gap-2">
          {STOPS.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Go to ${s.title}`}
              onClick={() => itemRefs.current[s.id]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })}
              className={`chip ${active === s.id ? "!border-[var(--accent-pink)]" : ""}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </header>

      {/* Path + stops container */}
      <div className="mt-5 relative">
        {/* Animated gradient path (desktop) */}
        <svg className="hidden md:block absolute inset-x-0 top-10 h-40 w-full pointer-events-none" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="rg" x1="0" x2="1">
              <stop offset="0%" stopColor="var(--accent-violet)" />
              <stop offset="100%" stopColor="var(--accent-pink)" />
            </linearGradient>
          </defs>
          <path
            d="M40,150 C240,30 420,30 600,150 C780,270 960,270 1160,150"
            fill="none"
            stroke="url(#rg)"
            strokeWidth="3"
            strokeDasharray="8 10"
            className="path-dash"
            opacity="0.6"
          />
        </svg>

        {/* Stops (scroll-snap) */}
        <div
          ref={wrapRef}
          className="
            roadmap-snap mt-2
            flex md:flex-row flex-col gap-4
            md:overflow-x-auto md:pb-2
          "
        >
          {STOPS.map((s, i) => (
            <div
              key={s.id}
              data-id={s.id}
              ref={el => (itemRefs.current[s.id] = el)}
              className="
                snap-center shrink-0
                md:w-[min(520px,80%)] w-full
              "
            >
              <article
                className={`
                  surface-muted rounded-2xl p-5
                  transition-transform duration-200
                  ${active === s.id ? "ring-1 ring-[var(--accent-pink)] scale-[1.01]" : ""}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`dot ${i <= idx ? "dot-on" : ""}`} aria-hidden />
                  <div>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="text-sm opacity-85">{s.sub}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Link to={s.cta.to} className="btn btn-anim btn-pink">{s.cta.label}</Link>
                  <span className="text-xs opacity-70">Step {i + 1} of {STOPS.length}</span>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
