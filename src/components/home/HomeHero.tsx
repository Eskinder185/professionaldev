import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, Hammer, Sprout, Sparkles, Check } from "lucide-react";

const STEPS = [
  {
    phase: "Discover",
    hint: "Path & fit",
    detail: "Choose your direction and understand where you fit before you optimize the wrong profile.",
    Icon: Compass,
  },
  {
    phase: "Build",
    hint: "Visible proof",
    detail: "Turn skills and projects into résumé lines, repos, and stories reviewers can verify fast.",
    Icon: Hammer,
  },
  {
    phase: "Grow",
    hint: "Apply & iterate",
    detail: "Roadmaps, trackers, and rhythm so applications and follow-through stay measurable.",
    Icon: Sprout,
  },
] as const;

const PROOF_POINTS = [
  "Career path blueprints and cert roadmaps you can execute",
  "ATS-ready résumé tooling and keyword alignment",
  "Portfolio, GitHub, and interview prep that produces evidence—not notes",
] as const;

export default function HomeHero() {
  return (
    <section
      className="relative border-b border-black/[0.06] dark:border-white/[0.08]"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto max-w-content px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-14 md:pb-24 md:pt-16 lg:pb-28 lg:pt-20">
        <div className="grid items-start gap-14 lg:grid-cols-12 lg:gap-16 xl:gap-20">
          <div className="lg:col-span-6 xl:col-span-5">
            <p className="section-label">Professional development platform</p>

            <h1
              id="hero-heading"
              className="mt-5 text-balance text-[2.125rem] font-semibold leading-[1.06] tracking-[-0.035em] text-ink dark:text-white sm:text-5xl sm:leading-[1.04] md:text-[3rem] md:leading-[1.02]"
            >
              Pick a direction.
              <span className="mt-1 block text-ink dark:text-white sm:mt-0">
                Build real proof. Get hired.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lead leading-relaxed text-ink-muted">
              This is a <span className="font-medium text-ink dark:text-white">step-by-step system</span> for tech
              job seekers: <span className="text-ink dark:text-white/90">pick a direction</span>, build proof,
              pass ATS screening, prep interviews with confidence, and close the loop toward an offer. Every
              phase is built to produce evidence hiring teams can see—not study notes that never leave your desk.
            </p>

            <ul className="mt-8 max-w-xl space-y-3" aria-label="What you get">
              {PROOF_POINTS.map((line) => (
                <li key={line} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent dark:bg-accent/20"
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <p className="mt-8 max-w-xl text-sm leading-relaxed text-ink-muted">
              <span className="font-medium text-ink dark:text-white">Who it’s for:</span> engineers and tech
              candidates who need clarity, credible artifacts, and interview reps—not another generic article.
              <span className="mt-2 block">
                <span className="font-medium text-ink dark:text-white">How to begin:</span> start in{" "}
                <span className="text-ink dark:text-white">Discover</span> if you’re choosing a path, or jump to{" "}
                <span className="text-ink dark:text-white">Build</span> if you already know your target role.
              </span>
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                to="/self-assessment"
                className="btn btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold sm:w-auto sm:min-h-11"
              >
                Start with Discover
                <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </Link>
              <Link
                to="/career-tools"
                className="btn inline-flex min-h-12 w-full items-center justify-center px-8 py-3.5 text-base font-semibold sm:w-auto sm:min-h-11"
              >
                Explore Build
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 xl:col-span-7">
            <div className="border-t border-black/[0.07] pt-10 dark:border-white/[0.09] sm:pt-12 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-2 xl:pl-14">
              <p className="text-micro font-semibold uppercase tracking-[0.16em] text-ink-muted">Pathway</p>
              <p className="mt-2 max-w-md text-base font-medium leading-snug text-ink dark:text-white">
                Discover → Build → Grow. Same sequence whenever you refocus—each step feeds the artifacts
                recruiters and ATS tools evaluate.
              </p>

              <div className="relative mt-10 lg:mt-12">
                <div className="hidden lg:block">
                  <div className="flex w-full items-start justify-between gap-2">
                    {STEPS.map(({ phase, hint, Icon }, i) => (
                      <React.Fragment key={phase}>
                        {i > 0 ? (
                          <div
                            className="mt-[1.375rem] h-px min-h-0 min-w-[0.5rem] flex-1 bg-gradient-to-r from-transparent via-ink-faint/35 to-transparent dark:via-white/14"
                            aria-hidden
                          />
                        ) : null}
                        <div className="flex w-[30%] max-w-[9.5rem] shrink-0 flex-col items-center text-center">
                          <div className="flex h-11 w-11 items-center justify-center text-accent">
                            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                          </div>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink dark:text-white">
                            {phase}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium leading-snug text-ink-muted">{hint}</p>
                          <p className="mt-2 text-[11px] leading-snug text-ink-muted/90 dark:text-ink-muted">
                            {STEPS[i].detail}
                          </p>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex justify-center" aria-hidden>
                    <div className="h-10 w-px bg-gradient-to-b from-ink-faint/35 to-accent/35 dark:from-white/15 dark:to-accent/45" />
                  </div>
                </div>

                <ol className="space-y-5 lg:hidden">
                  {STEPS.map(({ phase, hint, detail, Icon }, i) => (
                    <li key={phase} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center text-accent">
                          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        </div>
                        {i < STEPS.length - 1 ? (
                          <div className="mt-2 h-8 w-px bg-gradient-to-b from-ink-faint/30 to-transparent dark:from-white/15" />
                        ) : (
                          <div className="mt-2 h-6 w-px bg-gradient-to-b from-accent/45 to-accent/15" />
                        )}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-semibold text-ink dark:text-white">{phase}</p>
                        <p className="text-xs font-medium text-ink-muted">{hint}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mx-auto max-w-lg lg:max-w-none">
                  <div className="surface-emphasis mt-8 border-l-[3px] border-l-[rgb(var(--tw-accent))] pl-5 pr-4 py-5 sm:pl-6 sm:pr-5 sm:py-6">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-micro font-semibold uppercase tracking-[0.14em] text-accent">
                          Your offer
                        </p>
                        <p className="mt-1.5 text-lg font-semibold tracking-tight text-ink dark:text-white sm:text-xl">
                          The bundle employers actually screen
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                          Hiring teams don’t grade your study habits—they scan your résumé, profile, repos, and
                          how you tell impact. This pathway is built so{" "}
                          <span className="text-ink dark:text-white/90">every stage outputs evidence</span>: clarity
                          from Discover, polished artifacts from Build, and a repeatable rhythm from Grow.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
