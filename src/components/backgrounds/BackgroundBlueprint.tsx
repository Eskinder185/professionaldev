import React from "react";

export default function BackgroundBlueprint() {
  const stroke = "rgba(99,102,241,0.15)"; // indigo-ish
  return (
    <svg className="bg-underlay" viewBox="0 0 1440 900" preserveAspectRatio="none">
      {Array.from({ length: 30 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 48} y1="0" x2={i * 48} y2="900" stroke={stroke} strokeWidth="1" />
      ))}
      {Array.from({ length: 18 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 48} x2="1440" y2={i * 48} stroke={stroke} strokeWidth="1" />
      ))}
      <g className="anim" style={{ animation: "wave-shift 12s linear infinite" }}>
        <path
          d="M -200 500 C 200 420, 400 620, 760 520 S 1200 460, 1800 500"
          stroke="rgba(99,102,241,0.35)" strokeWidth="2" fill="none" strokeDasharray="8 8"
        />
      </g>
    </svg>
  );
}

