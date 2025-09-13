import React from "react";

export default function LinkedInGuide() {
  return (
    <div className="space-y-6">
      <header className="surface-muted p-6">
        <h1 className="brand-heading text-2xl font-semibold">LinkedIn Guide</h1>
        <p>Use this structure to make recruiters instantly understand your value.</p>
      </header>

      <section className="surface p-5 hover-glow" style={{ ["--glow" as any]:"var(--accent-purple)" }}>
        <h2 className="font-semibold text-lg">1) Headline (120 characters)</h2>
        <p className="mt-1">Format: <b>Role</b> · key skills · impact.</p>
        <div className="surface-muted p-4 mt-3 rounded-xl text-sm">
          <div><b>Example:</b> Frontend Engineer · React + TypeScript · Shipped A/B features to 1M users</div>
        </div>
        <ul className="list-disc pl-5 mt-3 space-y-1 text-sm">
          <li>Include tool keywords you want to be found for.</li>
          <li>Avoid vague phrases (“hard worker”, “fast learner”).</li>
        </ul>
      </section>

      <section className="surface p-5 hover-glow" style={{ ["--glow" as any]:"var(--accent-blue)" }}>
        <h2 className="font-semibold text-lg">2) About (3–5 lines)</h2>
        <p className="mt-1">Think elevator pitch. Use one sentence per idea.</p>
        <div className="surface-muted p-4 mt-3 rounded-xl text-sm whitespace-pre-wrap">
{`• Focus area + years (“2y building accessible React systems”)
• Problem you love solving (“fast, reliable UI at scale”)
• Signature wins with a metric (“cut TTI -35% across 3 pages”)
• What you want next (“frontend platform or design systems”)`}
        </div>
      </section>

      <section className="surface p-5 hover-glow" style={{ ["--glow" as any]:"var(--accent-orange)" }}>
        <h2 className="font-semibold text-lg">3) Experience (impact bullets)</h2>
        <p className="mt-1">Use STAR/CARL thinking to craft <b>impact-first</b> bullets.</p>
        <div className="surface-muted p-4 mt-3 rounded-xl text-sm whitespace-pre-wrap">
{`• Led migration to Vite, improving build time 4× and saving 12 min/dev/day.
• Built CI cache step cutting pipeline from 14m → 6m (-57%).
• Partnered w/ design to ship dashboard (NPS +18, churn -2.1%).`}
        </div>
        <ul className="list-disc pl-5 mt-3 space-y-1 text-sm">
          <li>Add media under each role (screenshots, demo links, PDFs).</li>
          <li>Use “I” for your actions; “we” for collaboration.</li>
        </ul>
      </section>

      <section className="surface p-5 hover-glow">
        <h2 className="font-semibold text-lg">4) Featured & Projects</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li>Feature your portfolio, case studies, or 2–3 best repos.</li>
          <li>Title = outcome; description = tech + metrics.</li>
        </ul>
      </section>

      <section className="surface p-5 hover-glow">
        <h2 className="font-semibold text-lg">5) Skills & Endorsements</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li>Top 10 skills: match target roles (React, TypeScript, Node, AWS…)</li>
          <li>Ask teammates for endorsements after a shipped win.</li>
        </ul>
      </section>

      <section className="surface p-5 hover-glow">
        <h2 className="font-semibold text-lg">6) Settings & Hygiene</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li>Custom URL: <b>linkedin.com/in/yourname</b></li>
          <li>Open to Work: set target role, locations, and start date.</li>
          <li>Photo: friendly + professional; banner: your craft (not stock clutter).</li>
        </ul>
      </section>
    </div>
  );
}
