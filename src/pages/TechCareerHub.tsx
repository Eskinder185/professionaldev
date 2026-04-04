import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Cloud,
  Code2,
  Cpu,
  Github,
  Layers,
  Route,
  Server,
  Shield,
  type LucideIcon,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";

const sectionLabel = "text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted";
const sectionGap = "mt-14 border-t border-black/[0.07] pt-12 dark:border-white/[0.09] sm:mt-16 sm:pt-14";

const PATH_FAMILIES = [
  {
    title: "Data center / infrastructure",
    summary: "Hardware, facilities, networking, and on-the-ground reliability—where physical systems meet uptime.",
    Icon: Server,
  },
  {
    title: "Cloud engineering",
    summary: "Deploy and operate on managed cloud: automation, IaC, scaling, and service design without racking gear.",
    Icon: Cloud,
  },
  {
    title: "Cybersecurity",
    summary: "Identity, detection, monitoring, and response—reducing risk as systems and threats evolve.",
    Icon: Shield,
  },
  {
    title: "Software engineering",
    summary: "Product and platform behavior through code—features, APIs, and systems teams depend on.",
    Icon: Code2,
  },
] as const;

const FIT_HINTS = [
  { like: "physical gear, cabling, networking, and floor-level reliability", path: "data center / infrastructure" },
  { like: "automation, IaC, and cloud services", path: "cloud engineering" },
  { like: "identity, alerts, detection, and protecting live systems", path: "cybersecurity" },
  { like: "shipping features and platforms in code", path: "software engineering" },
] as const;

const TECH_SPINE = [
  "Networking fundamentals — how traffic moves, fails, and is secured between systems",
  "Systems, Linux, virtualization, and containers — runtimes you operate or build on",
  "Identity and access — authentication, authorization, and least privilege",
  "Monitoring, logs, alerts, and response — observable production behavior",
  "Secure design mindset — threats, boundaries, and safe defaults in what you ship",
] as const;

const PROOF_LOOP = [
  { step: "Learn the job task", detail: "Anchor study in what the role actually does day to day." },
  { step: "Build the skill in a project", detail: "Scope something shippable with a clear success criterion." },
  { step: "Publish evidence", detail: "Repo, README, demo—artifacts a reviewer can open without a call." },
  { step: "Tighten presentation", detail: "First-screen clarity: diagram, metrics, and what you personally owned." },
  { step: "Prepare the interview story", detail: "STAR/CARL that matches the repo—not generic talking points." },
] as const;

const PROOF_PACK = [
  { title: "Architecture diagram", hint: "Trust boundaries, data flow, failure domains—one orienting view." },
  { title: "Runbook", hint: "Operate, rollback, escalate—shows you think past launch day." },
  { title: "Monitoring plan", hint: "Signals, SLOs or checks, and what you’d page on." },
  { title: "Threat model", hint: "Assets, adversaries, mitigations—even a light pass reads as rigor." },
  { title: "Postmortem or failure story", hint: "Timeline, cause, fix, prevention—for behavioral depth." },
] as const;

const BLUEPRINTS = [
  {
    title: "Service with a contract",
    hint: "Small API or worker: OpenAPI or README contract, tests, and one production-minded concern (errors, idempotency, or auth).",
  },
  {
    title: "IaC + environment story",
    hint: "Terraform/Bicep/CloudFormation repo: modules, env separation, and a diagram of what deploys where.",
  },
  {
    title: "Security hardening pass",
    hint: "Baseline scan or manual review → prioritized fixes → before/after evidence and residual risk note.",
  },
  {
    title: "Reliability or chaos slice",
    hint: "Inject a failure, measure impact, update runbook or alert—shows operational maturity.",
  },
  {
    title: "Pipeline or batch job",
    hint: "Data path diagram, failure handling, and what you’d monitor when jobs slip or skew.",
  },
] as const;

type Tier = "Beginner" | "Intermediate" | "Advanced";
const TIERS: Tier[] = ["Beginner", "Intermediate", "Advanced"];

type PathRoadmap = { id: string; title: string; levels: Record<Tier, string[]> };

const PATH_ROADMAPS: PathRoadmap[] = [
  {
    id: "infra",
    title: "Data center / infrastructure",
    levels: {
      Beginner: [
        "Topology doc + one reliability metric you watch (uptime, latency, errors).",
        "Short runbook: failure → checks → escalation.",
      ],
      Intermediate: [
        "Change window with rollback notes and stakeholder comms.",
        "Monitoring slice: dashboard + what you’d alert on.",
      ],
      Advanced: [
        "Incident postmortem: timeline, root cause, preventive work.",
        "DR, SLO, or hardening contribution with measurable before/after.",
      ],
    },
  },
  {
    id: "cloud",
    title: "Cloud engineering",
    levels: {
      Beginner: [
        "Workload via IaC + README: run, cost knobs, teardown.",
        "Basic observability path you can screenshot in review.",
      ],
      Intermediate: [
        "CI with gates; env and secrets handling documented at high level.",
        "Multi-service sketch with network boundaries on a diagram.",
      ],
      Advanced: [
        "Platform or reliability change tied to prod: scaling, cost guardrail, or runbook.",
        "On-call or game-day story with metrics.",
      ],
    },
  },
  {
    id: "security",
    title: "Cybersecurity",
    levels: {
      Beginner: [
        "IAM / least-privilege write-up for a lab tenant or sample app.",
        "One detection rule, query, or exercise with what it would catch.",
      ],
      Intermediate: [
        "Threat model lite: assets, boundaries, top risks, mitigations.",
        "Vuln or hardening pass with before/after evidence.",
      ],
      Advanced: [
        "Tabletop or IR timeline tied to logs and comms.",
        "Governance or AppSec artifact with clear rationale.",
      ],
    },
  },
  {
    id: "software",
    title: "Software engineering",
    levels: {
      Beginner: [
        "Feature or tool: tests + README + demo or GIF.",
        "One measurable fix: latency, errors, or build time.",
      ],
      Intermediate: [
        "Service boundary: contracts, errors, basic metrics.",
        "ADR or design note: tradeoffs and how you’d validate.",
      ],
      Advanced: [
        "Cross-team delivery: migration, platform change, or outage mitigation with outcomes.",
        "Depth: profiling, security input, or scaling with graphs.",
      ],
    },
  },
];

type ToolRow = { title: string; href: string; blurb: string; Icon: LucideIcon };

const PORTFOLIO_TOOLS: ToolRow[] = [
  {
    title: "GitHub Profile Guide",
    href: "/career-tools/github",
    blurb: "Profile README, pins, topics, and repo hygiene for a 30-second scan.",
    Icon: Github,
  },
  {
    title: "Portfolio & GitHub checklist",
    href: "/career-tools/portfolio",
    blurb: "READMEs, demos, and how you frame impact for technical readers.",
    Icon: Layers,
  },
  {
    title: "Portfolio & GitHub audit",
    href: "/career/portfolio-audit",
    blurb: "Scorecard plus copy-paste templates for READMEs, issues, and PRs.",
    Icon: ClipboardList,
  },
];

const ROADMAP_LINKS: ToolRow[] = [
  {
    title: "Certification roadmaps",
    href: "/resources/roadmaps",
    blurb: "AWS SAA, Security+, and other sequenced tracks—pair every sprint with a shipped artifact.",
    Icon: Route,
  },
  {
    title: "Certifications & learning hub",
    href: "/resources/certs",
    blurb: "Domain deep dives by cloud, security, data, and software—certs as scaffolding, not the whole proof.",
    Icon: BookOpen,
  },
];

function HubLinkRow({ title, href, blurb, Icon }: ToolRow) {
  return (
    <li className="border-b border-black/[0.07] dark:border-white/[0.09]">
      <Link
        to={href}
        className="group -mx-1 flex gap-4 px-1 py-5 transition-colors duration-200 sm:gap-5 sm:py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-ink-muted transition-colors group-hover:text-ink dark:group-hover:text-white">
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold tracking-tight text-ink dark:text-white">{title}</span>
          <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{blurb}</span>
        </span>
        <ArrowRight
          className="mt-1 h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink-muted motion-reduce:transform-none dark:group-hover:text-white/70"
          strokeWidth={1.5}
          aria-hidden
        />
      </Link>
    </li>
  );
}

export default function TechCareerHub() {
  return (
    <div className="pb-20 sm:pb-24">
      <PageHeader
        eyebrow="Tech Career Hub"
        title="Choose a path. Build technical proof. Get hired."
        sub="Everything on this page is for computer science and tech-career targets: role families, a technical skill spine, proof packs, project blueprints, GitHub positioning, and cert-backed roadmaps. The rest of the site handles general professional development—résumé, interviews, values, and communication—without mixing in specialization clutter."
      />

      <section aria-labelledby="paths-heading" className={sectionGap}>
        <h2 id="paths-heading" className={sectionLabel}>
          Pick your tech path
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          Same industry, different craft. Use preferences and assessments in{" "}
          <Link to="/self-assessment" className="font-medium text-accent underline-offset-2 hover:underline">
            Discover
          </Link>{" "}
          alongside this map.
        </p>
        <ul className="mt-8 grid gap-0 sm:grid-cols-2 sm:gap-x-10 lg:gap-x-14">
          {PATH_FAMILIES.map(({ title, summary, Icon }) => (
            <li key={title} className="flex gap-4 border-b border-black/[0.06] py-6 dark:border-white/[0.08] sm:py-7">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center text-accent" aria-hidden>
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold tracking-tight text-ink dark:text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{summary}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-10 max-w-2xl space-y-3">
          <p className={sectionLabel}>Which path fits?</p>
          <ul className="space-y-3">
            {FIT_HINTS.map(({ like, path }) => (
              <li key={path} className="border-l-2 border-accent/30 pl-4 text-sm text-ink-muted dark:border-accent/40">
                If you like <span className="font-medium text-ink dark:text-white">{like}</span> — start with{" "}
                <span className="font-medium text-ink dark:text-white">{path}</span>.
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="spine-heading" className={sectionGap}>
        <h2 id="spine-heading" className={sectionLabel}>
          Core technical skills
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Stack depth where you’re thin, then prove it in projects. These areas show up across infra, cloud, security,
          and software interviews.
        </p>
        <ul className="mt-8 max-w-2xl space-y-3.5">
          {TECH_SPINE.map((line) => {
            const [head, ...rest] = line.split(" — ");
            const tail = rest.join(" — ");
            return (
              <li
                key={line}
                className="border-l-2 border-black/[0.08] py-0.5 pl-4 text-sm leading-relaxed dark:border-white/[0.12]"
              >
                <span className="font-medium text-ink dark:text-white">{head}</span>
                {tail ? <span className="text-ink-muted"> — {tail}</span> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="proof-heading" className={sectionGap}>
        <h2 id="proof-heading" className={sectionLabel}>
          Build proof, not just knowledge
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          Employers evaluate what they can verify quickly: repos, diagrams, runbooks, and interview answers that match
          those artifacts. Follow a tight loop so every sprint adds evidence, not only notes.
        </p>
        <ol className="mt-8 max-w-2xl space-y-5">
          {PROOF_LOOP.map(({ step, detail }, i) => (
            <li key={step} className="flex gap-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/[0.1] font-mono text-xs font-semibold tabular-nums text-ink dark:border-white/[0.15] dark:text-white"
                aria-hidden
              >
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-ink dark:text-white">{step}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-ink-muted">
          General résumé and ATS polish lives in{" "}
          <Link to="/career-tools/resume-grader" className="font-medium text-accent underline-offset-2 hover:underline">
            Build → Résumé Grader
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="pack-heading" className={sectionGap}>
        <h2 id="pack-heading" className={sectionLabel}>
          Proof packs
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Mature projects ship a bundle reviewers can skim in minutes. Add items as the work hardens.
        </p>
        <div className="mt-8 surface-emphasis border-l-[3px] border-l-[rgb(var(--tw-accent))] px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex items-start gap-3">
            <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} aria-hidden />
            <ul className="min-w-0 space-y-4">
              {PROOF_PACK.map(({ title, hint }) => (
                <li key={title}>
                  <p className="text-sm font-medium text-ink dark:text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{hint}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="blueprint-heading" className={sectionGap}>
        <h2 id="blueprint-heading" className={sectionLabel}>
          Technical project blueprints
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Pick a blueprint, scope two weeks of work, and exit with a repo plus at least one proof-pack item. Rotate
          blueprints to cover breadth.
        </p>
        <ul className="mt-8 max-w-2xl space-y-5">
          {BLUEPRINTS.map(({ title, hint }) => (
            <li key={title} className="border-l-2 border-black/[0.08] pl-4 dark:border-white/[0.12]">
              <p className="font-semibold text-ink dark:text-white">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{hint}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="portfolio-heading" className={sectionGap}>
        <h2 id="portfolio-heading" className={sectionLabel}>
          Technical portfolio & GitHub
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Technical hiring starts with a fast scan of profile and repos. These tools align your presentation with how
          engineers and hiring managers actually read GitHub.
        </p>
        <ul className="mt-8 border-t border-black/[0.07] dark:border-white/[0.09]" role="list">
          {PORTFOLIO_TOOLS.map((t) => (
            <HubLinkRow key={t.href} {...t} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="roadmaps-heading" className={sectionGap}>
        <h2 id="roadmaps-heading" className={sectionLabel}>
          Roadmaps & certification support
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Certs sequence curriculum; they should ride alongside shipped projects. Use Grow for weekly rhythm and
          applications once proof is moving.
        </p>
        <ul className="mt-8 border-t border-black/[0.07] dark:border-white/[0.09]" role="list">
          {ROADMAP_LINKS.map((t) => (
            <HubLinkRow key={t.href} {...t} />
          ))}
        </ul>

        <div className="mt-14 space-y-10">
          <h3 className="text-base font-semibold text-ink dark:text-white sm:text-lg">Path milestones (proof-focused)</h3>
          <p className="max-w-2xl text-sm text-ink-muted">
            Beginner → intermediate → advanced: each bullet is something you could demo or defend—not a course title.
          </p>
          {PATH_ROADMAPS.map((path) => (
            <div key={path.id}>
              <h4 className="text-sm font-semibold text-ink dark:text-white sm:text-base">{path.title}</h4>
              <div className="mt-5 grid gap-8 sm:grid-cols-3 sm:gap-6">
                {TIERS.map((tier) => (
                  <div key={tier} className="border-l-2 border-black/[0.08] pl-4 dark:border-white/[0.12]">
                    <p className="text-caption font-semibold uppercase tracking-[0.12em] text-accent">{tier}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
                      {path.levels[tier].map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="job-ready-heading" className={sectionGap}>
        <h2 id="job-ready-heading" className={sectionLabel}>
          Job-ready technical narrative
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Proof only converts when you can explain tradeoffs, failures, and metrics. Use Build’s behavioral and STAR
          tools with stories that reference the repos and diagrams above—same facts, interview packaging.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/career-tools/behavioral"
            className="rounded-full border border-black/[0.1] px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.04] dark:border-white/[0.12] dark:hover:bg-white/[0.06]"
          >
            Behavioral Q&A
          </Link>
          <Link
            to="/career-tools/stories"
            className="rounded-full border border-black/[0.1] px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.04] dark:border-white/[0.12] dark:hover:bg-white/[0.06]"
          >
            STAR & CARL stories
          </Link>
          <Link
            to="/career/star-tool"
            className="rounded-full border border-black/[0.1] px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.04] dark:border-white/[0.12] dark:hover:bg-white/[0.06]"
          >
            STAR method tool
          </Link>
          <Link
            to="/career-tools/interview-sim"
            className="rounded-full border border-black/[0.1] px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.04] dark:border-white/[0.12] dark:hover:bg-white/[0.06]"
          >
            Mock interview
          </Link>
        </ul>
      </section>

      <section aria-labelledby="cta-heading" className={sectionGap}>
        <h2 id="cta-heading" className={sectionLabel}>
          General professional development
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          Résumé grading, LinkedIn, elevator pitches, values, and strengths live outside this hub so technical and
          general workflows stay clear. Move between them as needed—the loop is still Discover → Build → Grow.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link to="/self-assessment" className="btn btn-primary inline-flex min-h-11 items-center gap-2 px-6 font-semibold">
            Discover
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link to="/career-tools" className="btn surface-muted inline-flex min-h-11 items-center gap-2 px-6 font-semibold">
            Build (general tools)
          </Link>
          <Link to="/resources" className="btn surface-muted inline-flex min-h-11 items-center gap-2 px-6 font-semibold">
            Grow
          </Link>
          <Link to="/" className="btn surface-muted inline-flex min-h-11 items-center px-6 font-semibold">
            Home
          </Link>
        </div>
      </section>
    </div>
  );
}
