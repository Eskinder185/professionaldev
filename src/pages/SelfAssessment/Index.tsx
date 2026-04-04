import React from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Cpu, HeartHandshake, Map, type LucideIcon } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";

const TOOLS: {
  title: string;
  role: string;
  blurb: string;
  href: string;
  icon: string;
}[] = [
  {
    title: "Strengths & Weaknesses Test",
    role: "How you work",
    blurb: "Pace, focus, communication, and ownership—ground your plan in how you actually perform under pressure.",
    href: "/self/strengths",
    icon: "Activity",
  },
  {
    title: "Core Values Workshop",
    role: "What environment fits you",
    blurb: "Rank and compare values so your next role matches tradeoffs you can sustain—not just a title.",
    href: "/self/values",
    icon: "HeartHandshake",
  },
  {
    title: "Career Interests Map",
    role: "Where your energy points",
    blurb: "Scenario-style prompts to surface direction; pair with strengths and values before you commit.",
    href: "/self/interests",
    icon: "Map",
  },
];

const ICONS: Record<string, LucideIcon> = {
  Activity,
  HeartHandshake,
  Map,
};

const sectionTitle = "text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted";
const sectionGap = "mt-12 border-t border-black/[0.07] pt-12 dark:border-white/[0.09] sm:mt-16 sm:pt-14";

export default function SelfAssessment() {
  return (
    <div className="pb-20 sm:pb-24">
      <PageHeader
        eyebrow="Discover"
        title="Know yourself, then choose the right path."
        sub="Discover is about clarity before execution: how you work, what you value, and where your interests pull you. Use these tools in any order—together they reduce guesswork before you invest in materials, applications, or deep study."
      />

      <section aria-labelledby="tech-heading" className={sectionGap}>
        <h2 id="tech-heading" className={sectionTitle}>
          Targeting tech & engineering roles?
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          Paths like infrastructure, cloud, cybersecurity, and software engineering—plus technical skill spines, proof
          packs, and GitHub positioning—live in one place so this page stays about you, not about stacks.
        </p>
        <div className="mt-6">
          <Link
            to="/tech-career-hub"
            className="btn btn-primary inline-flex min-h-11 items-center gap-2 px-6 font-semibold"
          >
            <Cpu className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Open Tech Career Hub
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-labelledby="tools-heading" className={sectionGap}>
        <h2 id="tools-heading" className={sectionTitle}>
          Self-assessment tools
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Three lenses on fit: working style, environment, and interests. Outcomes here inform both general job search
          and technical specialization.
        </p>
        <ul className="mt-8 border-t border-black/[0.07] dark:border-white/[0.09]" role="list">
          {TOOLS.map((it) => {
            const Lucide = ICONS[it.icon] ?? Activity;
            return (
              <li key={it.href} className="border-b border-black/[0.07] dark:border-white/[0.09]">
                <Link
                  to={it.href}
                  className="group -mx-1 flex gap-4 px-1 py-6 transition-colors duration-200 sm:gap-5 sm:py-7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center text-ink-muted transition-colors group-hover:text-ink dark:group-hover:text-white">
                    <Lucide className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold tracking-tight text-ink dark:text-white">{it.title}</span>
                    <span className="mt-1 block text-caption font-medium uppercase tracking-[0.08em] text-accent">
                      {it.role}
                    </span>
                    <span className="mt-2 block text-sm leading-relaxed text-ink-muted">{it.blurb}</span>
                  </span>
                  <ArrowRight
                    className="mt-1 h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink-muted motion-reduce:transform-none dark:group-hover:text-white/70"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="next-heading" className={sectionGap}>
        <h2 id="next-heading" className={sectionTitle}>
          What happens next
        </h2>
        <div className="mt-6 max-w-2xl space-y-4 text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          <p>
            <span className="font-medium text-ink dark:text-white">Build</span> is where clarity becomes proof: résumé
            and profile materials, interview stories, and work samples—so reviewers see evidence, not intention.
          </p>
          <p>
            If you’re on a technical track, use{" "}
            <Link to="/tech-career-hub" className="font-medium text-accent underline-offset-2 hover:underline">
              Tech Career Hub
            </Link>{" "}
            alongside Build for repos, proof packs, and engineering roadmaps.
          </p>
        </div>
        <div className="mt-8">
          <Link
            to="/career-tools"
            className="btn btn-primary inline-flex min-h-11 items-center gap-2 px-6 font-semibold"
          >
            Go to Build
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
