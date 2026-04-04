import React from "react";

export default function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-content px-4 py-10 sm:px-0">
        {children}
      </div>
    </div>
  );
}
