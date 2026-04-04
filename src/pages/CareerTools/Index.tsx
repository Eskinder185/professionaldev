import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Cpu,
  FileText,
  Linkedin,
  ListOrdered,
  MessageCircle,
  Mic,
  ScrollText,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";

const PROOF_LOOP = [
  { step: "Name the claim", detail: "One sentence on what a reviewer should believe about you after 60 seconds." },
  { step: "Back it with an artifact", detail: "Résumé section, writing sample, project summary, or doc they can skim." },
  { step: "Align your surfaces", detail: "LinkedIn, file, and pitch should tell the same story—no mixed messages." },
  { step: "Stress-test in practice", detail: "Behavioral prep and mock reps so spoken answers cite the same proof." },
  { step: "Schedule the next pass", detail: "Small weekly upgrades beat one-off hero edits." },
] as const;

type ToolRow = { title: string; href: string; blurb: string; Icon: LucideIcon };

const TOOL_GROUPS: { id: string; label: string; intro: string; tools: ToolRow[] }[] = [
  {
    id: "resume-ats",
    label: "Résumé & profile",
    intro: "Screening is fast—your file and headline have to earn the human read.",
    tools: [
      {
        title: "Résumé Grader",
        href: "/career-tools/resume-grader",
        blurb: "ATS-style scoring, structure, and keyword alignment before you send the next application.",
        Icon: FileText,
      },
      {
        title: "LinkedIn Guide",
        href: "/career-tools/linkedin",
        blurb: "Headline, About, and experience patterns for clarity and credibility.",
        Icon: Linkedin,
      },
    ],
  },
  {
    id: "interview",
    label: "Interview prep",
    intro: "Stories and practice reps that match what you put on paper.",
    tools: [
      {
        title: "Behavioral Q&A",
        href: "/career-tools/behavioral",
        blurb: "Prompts, STAR/CARL drafting, copy-ready answers, optional recording.",
        Icon: MessageCircle,
      },
      {
        title: "STAR & CARL story builder",
        href: "/career-tools/stories",
        blurb: "Narratives in both frameworks side by side.",
        Icon: ScrollText,
      },
      {
        title: "STAR answer practice",
        href: "/career-tools/star",
        blurb: "Quick four-field generator for a single answer.",
        Icon: Zap,
      },
      {
        title: "STAR method tool",
        href: "/career/star-tool",
        blurb: "Guided steps, timer, library, PDF export.",
        Icon: ListOrdered,
      },
      {
        title: "Mock interview",
        href: "/career-tools/interview-sim",
        blurb: "Timer, notes, optional recording—local to your browser.",
        Icon: Video,
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    intro: "Short verbal positioning for intros, screens, and networking.",
    tools: [
      {
        title: "Elevator pitch studio",
        href: "/career-tools/elevator-studio",
        blurb: "Script, teleprompter, and recording.",
        Icon: Mic,
      },
      {
        title: "Elevator pitch generator",
        href: "/career-tools/elevator",
        blurb: "Fast four-field pitch to refine elsewhere.",
        Icon: Mic,
      },
    ],
  },
];

const sectionLabel = "text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted";
const sectionGap = "mt-14 border-t border-black/[0.07] pt-12 dark:border-white/[0.09] sm:mt-16 sm:pt-14";

function ToolLinkRow({ title, href, blurb, Icon }: ToolRow) {
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

export default function CareerTools() {
  return (
    <div className="pb-20 sm:pb-24">
      <PageHeader
        eyebrow="Build"
        title="Turn clarity into proof anyone can evaluate."
        sub="Build is the general execution layer: materials and practice that work across roles—résumé, LinkedIn, behavioral stories, and pitches. Recruiters respond to evidence they can verify. For technical repos, architecture, proof packs, and engineering roadmaps, use Tech Career Hub so this page stays focused on career artifacts everyone needs."
      />

      <section aria-labelledby="loop-heading" className={sectionGap}>
        <h2 id="loop-heading" className={sectionLabel}>
          Proof loop
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Repeat on a weekly cadence—each lap tightens the same story across file, profile, and interview.
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
      </section>

      <section aria-labelledby="tech-exec-heading" className={sectionGap}>
        <h2 id="tech-exec-heading" className={sectionLabel}>
          Technical & engineering proof
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          GitHub READMEs, architecture diagrams, runbooks, certification-backed roadmaps, and path-specific milestones
          live in Tech Career Hub—so engineering candidates get depth without crowding general Build tools.
        </p>
        <div className="mt-6">
          <Link
            to="/tech-career-hub"
            className="btn btn-primary inline-flex min-h-11 items-center gap-2 px-6 font-semibold"
          >
            <Cpu className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Tech Career Hub
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-labelledby="tools-heading" className={sectionGap}>
        <h2 id="tools-heading" className={sectionLabel}>
          Career tools by purpose
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Pick one lane per session—depth beats opening every tool at once.
        </p>

        {TOOL_GROUPS.map((group) => (
          <div key={group.id} className="mt-12 first:mt-10 sm:mt-14 sm:first:mt-12">
            <h3 className="text-lg font-semibold tracking-tight text-ink dark:text-white">{group.label}</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{group.intro}</p>
            <ul className="mt-6 border-t border-black/[0.07] dark:border-white/[0.09]" role="list">
              {group.tools.map((t) => (
                <ToolLinkRow key={t.href} {...t} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="outcomes-heading" className={sectionGap}>
        <h2 id="outcomes-heading" className={sectionLabel}>
          What you should leave Build with
        </h2>
        <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">Résumé bullets</span> tied to outcomes and
              metrics, not duty lists.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">LinkedIn</span> aligned with the same headline
              story as your file.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">STAR/CARL stories</span> you can deliver in under
              two minutes.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">A pitch</span> you can say out loud without
              sounding generic.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              For <span className="font-medium text-ink dark:text-white">technical roles</span>, a parallel track in{" "}
              <Link to="/tech-career-hub" className="font-medium text-accent underline-offset-2 hover:underline">
                Tech Career Hub
              </Link>{" "}
              for repos and proof packs.
            </span>
          </li>
        </ul>
        <p className="mt-8 text-sm text-ink-muted">
          Next:{" "}
          <Link
            to="/resources"
            className="font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]"
          >
            Grow
          </Link>
          — applications, trackers, and weekly rhythm.
        </p>
      </section>
    </div>
  );
}
