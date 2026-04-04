import React from "react";
import { Link } from "react-router-dom";
import { Compass, Hammer, Sprout } from "lucide-react";
import SectionShell from "./SectionShell";

const pillars = [
  {
    step: "01",
    title: "Discover",
    description:
      "Lock a direction before you polish the wrong story. Assessments map strengths, values, and role fit so your next moves target a credible path—not random applications.",
    href: "/self-assessment",
    cta: "Open Discover",
    Icon: Compass,
  },
  {
    step: "02",
    title: "Build",
    description:
      "Convert learning into proof: ATS-tight résumé, LinkedIn and GitHub signals, STAR stories, and portfolio hygiene. Reviewers get impact in the first screen—not after a second read.",
    href: "/career-tools",
    cta: "Open Build",
    Icon: Hammer,
  },
  {
    step: "03",
    title: "Grow",
    description:
      "Execute with structure: certification roadmaps, skill and application trackers, and focus habits. You’ll see progress as logged output—offers come from consistent iteration.",
    href: "/resources",
    cta: "Open Grow",
    Icon: Sprout,
  },
] as const;

export default function HomePillars() {
  return (
    <SectionShell className="!pt-14 md:!pt-[4.5rem]">
      <div className="mx-auto max-w-3xl text-center">
        <p className="section-label">In the product</p>
        <h2 className="mt-4 text-balance text-title text-ink dark:text-white sm:text-4xl sm:leading-[1.12]">
          A career operating system—not a resource blog
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-body leading-relaxed text-ink-muted sm:text-lead">
          Sequenced modules, not endless reading. Discover, Build, and Grow function as layers of the same product:
          each one is where you produce the artifacts and habits that compound into an offer.
        </p>
      </div>

      <div className="mt-14 grid gap-0 border-t border-black/[0.07] pt-14 dark:border-white/[0.09] md:grid-cols-3 md:gap-10 md:pt-16 lg:gap-12">
        {pillars.map(({ step, title, description, href, cta, Icon }) => (
          <article key={title} className="group flex flex-col border-b border-black/[0.07] py-10 last:border-b-0 dark:border-white/[0.09] md:border-b-0 md:py-0 md:pt-1">
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[0.6875rem] font-semibold tabular-nums tracking-widest text-ink-faint">
                {step}
              </span>
              <Icon className="h-5 w-5 shrink-0 text-accent/90" strokeWidth={1.75} aria-hidden />
            </div>

            <h3 className="mt-6 text-title-sm text-ink dark:text-white md:mt-8">{title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem] sm:leading-relaxed">
              {description}
            </p>

            <Link
              to={href}
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-4 transition-colors hover:text-accent-muted hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]"
            >
              {cta}
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
