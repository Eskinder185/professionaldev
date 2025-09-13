import React from "react";
import FloatingHero from "../components/home/CircularOrbitHero";
import PDCoach from "../components/chat/PDCoach";

export default function Home() {
  return (
    <div className="space-y-6">
      <header className="surface-muted p-6">
        <h1 className="brand-heading text-2xl font-semibold">Welcome</h1>
        <p>Discover who you are → Build proof → Grow with the right resources.</p>
      </header>

      <FloatingHero />

      {/* Floating on-page chatbot */}
      <PDCoach />
    </div>
  );
}
