import React from "react";

export default function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10">
        {children}
      </div>
    </div>
  );
}
