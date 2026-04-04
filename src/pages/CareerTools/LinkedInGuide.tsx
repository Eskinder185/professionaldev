import React from "react";
import PageHeader from "../../components/ui/PageHeader";

const sectionClass = "border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12";
const exampleClass = "mt-4 border-l-2 border-accent/35 py-1 pl-4 text-sm text-ink-muted";

export default function LinkedInGuide() {
  return (
    <div className="space-y-0 pb-16">
      <PageHeader
        eyebrow="Career Tools"
        title="LinkedIn Guide"
        sub="Use this structure so recruiters quickly understand your value."
      />

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-ink dark:text-white">1) Headline (120 characters)</h2>
        <p className="mt-1 text-body text-ink-muted">
          Format: <strong className="text-ink dark:text-white">Role</strong> · key skills · impact.
        </p>
        <div className={exampleClass}>
          <div>
            <strong className="text-ink dark:text-white">Example:</strong> Frontend Engineer · React + TypeScript · Shipped A/B features to 1M users
          </div>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>Include tool keywords you want to be found for.</li>
          <li>Avoid vague phrases (“hard worker”, “fast learner”).</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-ink dark:text-white">2) About (3–5 lines)</h2>
        <p className="mt-1 text-body text-ink-muted">Think elevator pitch. Use one sentence per idea.</p>
        <pre className={`${exampleClass} whitespace-pre-wrap font-sans`}>
{`• Focus area + years (“2y building accessible React systems”)
• Problem you love solving (“fast, reliable UI at scale”)
• Signature wins with a metric (“cut TTI -35% across 3 pages”)
• What you want next (“frontend platform or design systems”)`}
        </pre>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-ink dark:text-white">3) Experience (impact bullets)</h2>
        <p className="mt-1 text-body text-ink-muted">
          Use STAR/CARL thinking to craft <strong className="text-ink dark:text-white">impact-first</strong> bullets.
        </p>
        <pre className={`${exampleClass} whitespace-pre-wrap font-sans`}>
{`• Led migration to Vite, improving build time 4× and saving 12 min/dev/day.
• Built CI cache step cutting pipeline from 14m → 6m (-57%).
• Partnered w/ design to ship dashboard (NPS +18, churn -2.1%).`}
        </pre>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>Add media under each role (screenshots, demo links, PDFs).</li>
          <li>Use “I” for your actions; “we” for collaboration.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-ink dark:text-white">4) Featured &amp; Projects</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>Feature your portfolio, case studies, or 2–3 best repos.</li>
          <li>Title = outcome; description = tech + metrics.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-ink dark:text-white">5) Skills &amp; Endorsements</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>Top 10 skills: match target roles (React, TypeScript, Node, AWS…)</li>
          <li>Ask teammates for endorsements after a shipped win.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-ink dark:text-white">6) Settings &amp; Hygiene</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>
            Custom URL: <strong className="text-ink dark:text-white">linkedin.com/in/yourname</strong>
          </li>
          <li>Open to Work: set target role, locations, and start date.</li>
          <li>Photo: friendly + professional; banner: your craft (not stock clutter).</li>
        </ul>
      </section>
    </div>
  );
}
