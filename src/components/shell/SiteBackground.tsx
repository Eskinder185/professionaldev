import React from "react";

/**
 * Near-static backdrop — content-first. Very low contrast washes only (no competing texture).
 */
export default function SiteBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-canvas" />
      <div
        className="absolute -top-[45%] left-1/2 h-[65vmin] w-[110vmin] -translate-x-1/2 rounded-full opacity-[0.14] dark:opacity-[0.09]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(var(--tw-accent), 0.2), transparent 75%)",
        }}
      />
      <div
        className="absolute bottom-[-25%] right-[-15%] h-[50vmin] w-[50vmin] rounded-full opacity-[0.08] dark:opacity-[0.05]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124, 58, 237, 0.12), transparent 72%)",
        }}
      />
      <div className="absolute inset-0 bg-grain opacity-[0.22] dark:opacity-[0.12]" />
    </div>
  );
}
