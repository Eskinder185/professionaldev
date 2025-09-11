import React, { Suspense, lazy } from "react";

const R3FScene = lazy(() => import("./R3FScene"));

function cssVar(n: string, fb: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
}

export default function Background3D() {
  const bgStart = cssVar("--bg-start", "#fff7ed");
  const bgEnd = cssVar("--bg-end", "#eef2ff");
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${bgStart}, ${bgEnd})` }} />
      <Suspense fallback={null}>
        <R3FScene />
      </Suspense>
    </div>
  );
}
