import React from "react";
import { useLocation } from "react-router-dom";
import BackgroundConstellations from "./BackgroundConstellations";
import BackgroundRoadmap from "./BackgroundRoadmap";
import BackgroundSineWaves from "./BackgroundSineWaves";
// import BackgroundBlueprint from "./BackgroundBlueprint"; // alternative

function cssVar(n: string, fb: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
}

export default function BackgroundRouter() {
  const { pathname } = useLocation();
  const p = pathname.toLowerCase();

  const bgStart = cssVar("--bg-start", "#fff7ed");
  const bgEnd = cssVar("--bg-end", "#eef2ff");

  let Bg: JSX.Element;
  if (p === "/" || p === "/home") Bg = <BackgroundRoadmap />;
  else if (p.includes("career-tools") || p.includes("self-assessment")) Bg = <BackgroundConstellations />;
  else if (p.includes("resources") || p.includes("settings")) Bg = <BackgroundSineWaves />; // or <BackgroundBlueprint />
  else Bg = <BackgroundSineWaves />;

  return (
    <div className="absolute inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${bgStart}, ${bgEnd})` }} />
      {Bg}
    </div>
  );
}

