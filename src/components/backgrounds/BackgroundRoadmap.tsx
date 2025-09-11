import React from "react";

function cssVar(n: string, fb: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

export default function BackgroundRoadmap() {
  const orange = cssVar("--accent-orange", "#fb923c");
  const blue   = cssVar("--accent-blue",   "#60a5fa");
  const purple = cssVar("--accent-purple", "#c084fc");
  const reduced = prefersReducedMotion();

  return (
    <svg className="bg-underlay" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs>
        <linearGradient id="rm-g" x1="0" x2="1">
          <stop offset="0%"   stopColor={orange} stopOpacity="0.45" />
          <stop offset="50%"  stopColor={blue}   stopOpacity="0.45" />
          <stop offset="100%" stopColor={purple} stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <path
        d="M -100 650 C 140 560, 360 760, 620 560 S 1100 480, 1600 580"
        fill="none" stroke="url(#rm-g)" strokeWidth="6" opacity="0.7"
      />

      {!reduced && (
        <circle r="6" fill="#fff" opacity=".95">
          <animateMotion dur="18s" repeatCount="indefinite"
            path="M -100 650 C 140 560, 360 760, 620 560 S 1100 480, 1600 580" />
        </circle>
      )}

      {[-60, 240, 520, 860, 1220, 1500].map((x, i) => (
        <g key={i} opacity="0.35">
          <rect x={x} y="600" width="2" height="70" fill={i % 2 ? blue : purple} />
        </g>
      ))}
    </svg>
  );
}

