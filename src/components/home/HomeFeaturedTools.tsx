import React from "react";
import { Link } from "react-router-dom";
import { Cpu, FileText, ScrollText, Linkedin } from "lucide-react";
import SectionShell from "./SectionShell";
import { ToolCard } from "../ui/cards";

const tools = [
  {
    title: "Résumé Grader",
    blurb:
      "Local ATS-style scoring: structure, keywords, and impact. Know what parsers and humans see before you send the next application.",
    href: "/career-tools/resume-grader",
    Icon: FileText,
  },
  {
    title: "Tech Career Hub",
    blurb:
      "Paths for infra, cloud, security, and software—core technical skills, proof packs, blueprints, and portfolio positioning in one structured place.",
    href: "/tech-career-hub",
    Icon: Cpu,
  },
  {
    title: "STAR story builder",
    blurb:
      "Guided Situation–Task–Action–Result drafting with timing and export—turn experience into interview-ready narratives.",
    href: "/career/star-tool",
    Icon: ScrollText,
  },
  {
    title: "LinkedIn & positioning",
    blurb:
      "Headline, About, and experience patterns built for clarity and credibility—not keyword stuffing that falls flat on humans.",
    href: "/career-tools/linkedin",
    Icon: Linkedin,
  },
] as const;

export default function HomeFeaturedTools() {
  return (
    <SectionShell className="border-t border-black/5 dark:border-white/[0.06] !pt-14 md:!pt-[4.5rem]">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="max-w-2xl">
          <p className="section-label">Tools</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-ink dark:text-white sm:text-4xl">
            What reviewers actually open
          </h2>
          <p className="mt-4 max-w-xl text-body leading-relaxed text-ink-muted sm:text-lead">
            The first minute decides whether you advance. These tools align with the files and profiles
            recruiters, hiring managers, and ATS pipelines touch first—so you optimize the signal they already
            use to filter.
          </p>
        </div>
        <Link
          to="/career-tools"
          className="shrink-0 text-sm font-semibold text-[rgb(var(--tw-accent))] underline-offset-4 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]"
        >
          All career tools →
        </Link>
      </div>

      <ul className="mt-12 border-t border-black/[0.07] dark:border-white/[0.09] md:mt-14" role="list">
        {tools.map(({ title, blurb, href, Icon }) => (
          <li key={href}>
            <ToolCard
              title={title}
              description={blurb}
              to={href}
              icon={<Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
