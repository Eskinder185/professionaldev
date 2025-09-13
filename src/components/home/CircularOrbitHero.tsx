import React from "react";
import { Link } from "react-router-dom";

/**
 * Floating hero with 3 dynamic tiles (Discover, Build, Grow).
 * - Tiles float and pulse with organic movement
 * - Hover effects with smooth transitions
 * - Mobile-friendly responsive design
 */
export default function FloatingHero() {
  const stops = [
    {
      id: "discover",
      title: "Discover",
      sub: "Strengths • Values • Interests",
      to: "/self-assessment",
      hue: "var(--accent-blue)",
      idx: 0,
    },
    {
      id: "build",
      title: "Build",
      sub: "Résumé • LinkedIn • Portfolio",
      to: "/career-tools",
      hue: "var(--accent-violet)",
      idx: 1,
    },
    {
      id: "grow",
      title: "Grow",
      sub: "Roadmaps • Trackers • Plans",
      to: "/resources",
      hue: "var(--accent-pink)",
      idx: 2,
    },
  ];

  return (
    <section className="surface p-5 rounded-2xl hover-glow">
      <header className="mb-8 text-center">
        <h2 className="text-2xl font-semibold brand-heading mb-2">Roadmap to Role</h2>
        <p className="opacity-80">Three paths to your goal—choose your journey.</p>
      </header>

      <div className="relative mx-auto floating-container">
        {/* Central goal */}
        <div className="floating-center">
          <div className="text-center">
            <div className="text-sm uppercase opacity-80 mb-1">Goal</div>
            <div className="text-3xl font-bold brand-heading">Your Offer</div>
            <div className="text-sm opacity-70 mt-2">Learn · Ship · Iterate</div>
          </div>
        </div>

        {/* Floating tiles */}
        {stops.map((s) => (
          <article
            key={s.id}
            className="floating-tile"
            style={
              {
                // @ts-ignore custom props for CSS
                "--i": s.idx,
                "--hue": s.hue,
              } as React.CSSProperties
            }
          >
            <div className="surface-muted rounded-xl p-5 floating-card group">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm opacity-85">{s.sub}</p>
                </div>
                <span className="dot dot-on" aria-hidden />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Link to={s.to} className="btn btn-anim btn-pink group-hover:scale-105 transition-transform">
                  Open
                </Link>
                <span className="text-xs opacity-70">
                  {s.idx + 1} / 3
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
