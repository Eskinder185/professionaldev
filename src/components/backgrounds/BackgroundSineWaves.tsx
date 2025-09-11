import React from "react";

function cssVar(n: string, fb: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
}

export default function BackgroundSineWaves() {
  const orange = cssVar("--accent-orange", "#fb923c");
  const blue   = cssVar("--accent-blue",   "#60a5fa");
  const purple = cssVar("--accent-purple", "#c084fc");

  return (
    <div className="bg-underlay overflow-hidden">
      <div className="absolute -inset-x-1 top-10 h-[60svh] opacity-[0.35]">
        <div className="absolute w-[200%] h-full anim" style={{ animation: "wave-shift 30s linear infinite" }}>
          <svg viewBox="0 0 2000 600" className="absolute w-full h-full">
            <defs>
              <linearGradient id="sw1" x1="0" x2="1">
                <stop offset="0%" stopColor={orange} />
                <stop offset="50%" stopColor={blue} />
                <stop offset="100%" stopColor={purple} />
              </linearGradient>
            </defs>
            <path d="M0,300 C 250,150 450,450 700,300 S 1150,450 1400,300 S 1650,150 2000,300"
              stroke="url(#sw1)" strokeWidth="8" fill="none" opacity="0.45" />
            <path d="M0,360 C 250,210 450,510 700,360 S 1150,510 1400,360 S 1650,210 2000,360"
              stroke="url(#sw1)" strokeWidth="6" fill="none" opacity="0.30" />
            <path d="M0,420 C 250,270 450,570 700,420 S 1150,570 1400,420 S 1650,270 2000,420"
              stroke="url(#sw1)" strokeWidth="4" fill="none" opacity="0.22" />
          </svg>
        </div>
      </div>
    </div>
  );
}

