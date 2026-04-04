import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Map,
  Route,
  Search,
  Table2,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";

const WEEKLY_SYSTEM = [
  {
    title: "Targeted applications",
    detail: "3–5 roles that match your path proof—not spray-and-pray. Each app ties to one bullet you can defend.",
  },
  {
    title: "Outreach",
    detail: "2+ thoughtful messages: hiring manager, recruiter, or engineer—reference their stack or product, not templates.",
  },
  {
    title: "Referrals",
    detail: "Ask one warm intro per week where you can show a specific repo or artifact you’d discuss.",
  },
  {
    title: "Follow-ups",
    detail: "Close the loop on every active thread: thank-you, status ping, or next step with a date.",
  },
] as const;

type ExecTool = { title: string; href: string; blurb: string; Icon: LucideIcon };

const EXECUTION_TOOLS: { id: string; label: string; intro: string; tools: ExecTool[] }[] = [
  {
    id: "track",
    label: "Trackers & pipeline",
    intro: "Make volume visible. Logs beat memory when you’re juggling screens, OAs, and callbacks.",
    tools: [
      {
        title: "Skill & job trackers",
        href: "/resources/trackers",
        blurb: "Practice hours, skill levels, and an applications CRM with CSV in/out.",
        Icon: Table2,
      },
      {
        title: "Application tracker",
        href: "/resources/app-tracker",
        blurb: "Lightweight application log if you want a separate CSV-first view.",
        Icon: Target,
      },
    ],
  },
  {
    id: "market",
    label: "Market & focus",
    intro: "Where to search and how to protect deep-work blocks while you execute.",
    tools: [
      {
        title: "Job sites",
        href: "/resources/job-sites",
        blurb: "Curated boards—pair with your weekly targets, not endless scrolling.",
        Icon: Search,
      },
      {
        title: "Time & productivity",
        href: "/resources/productivity",
        blurb: "Pomodoro, focus history, and rhythm so Grow doesn’t collapse under distraction.",
        Icon: Clock,
      },
    ],
  },
  {
    id: "learn-scaffold",
    label: "Roadmaps & cert library",
    intro: "Structured study paths when you need curriculum—not a substitute for shipped proof.",
    tools: [
      {
        title: "Certification roadmaps",
        href: "/resources/roadmaps",
        blurb: "High-level tracks (e.g., AWS SAA, Security+) to sequence serious study.",
        Icon: Route,
      },
      {
        title: "Certifications & learning hub",
        href: "/resources/certs",
        blurb: "Deep dives by domain—use alongside Build artifacts, not instead of them.",
        Icon: BookOpen,
      },
    ],
  },
];

const sectionLabel = "text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted";
const sectionGap = "mt-14 border-t border-black/[0.07] pt-12 dark:border-white/[0.09] sm:mt-16 sm:pt-14";

function ToolRow({ title, href, blurb, Icon }: ExecTool) {
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

export default function ResourcesIndex() {
  return (
    <div className="pb-20 sm:pb-24">
      <PageHeader
        eyebrow="Grow"
        title="Sustain momentum until hiring outcomes land."
        sub="Grow is the strategic layer after Build: roadmaps and certs scaffold learning, but weekly execution—applications, outreach, referrals, and follow-ups—is what converts proof into conversations. Progression here means measurable outputs every week, not passive consumption."
      />

      <section aria-labelledby="roadmap-heading" className={sectionGap}>
        <h2 id="roadmap-heading" className={sectionLabel}>
          Technical path milestones
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          Infrastructure, cloud, cybersecurity, and software engineering proof milestones—beginner through advanced—are
          centralized in Tech Career Hub so Grow stays focused on rhythm, applications, and execution.
        </p>
        <div className="mt-6">
          <Link
            to="/tech-career-hub"
            className="btn btn-primary inline-flex min-h-11 items-center gap-2 px-6 text-sm font-semibold"
          >
            Open Tech Career Hub
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-labelledby="certs-heading" className={sectionGap}>
        <h2 id="certs-heading" className={sectionLabel}>
          Certifications as support
        </h2>
        <div className="mt-5 max-w-2xl space-y-4 text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          <p>
            Certs are <span className="font-medium text-ink dark:text-white">curriculum scaffolding</span>: they
            sequence topics, force reps, and sometimes unlock screens. They are not, by themselves, the proof employers
            trust—repos, runbooks, diagrams, and interview stories still carry the weight.
          </p>
          <p>
            Pair every cert sprint with a{" "}
            <span className="font-medium text-ink dark:text-white">Build deliverable</span> (project, lab write-up, or
            dashboard) so studying shows up as evidence.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/resources/roadmaps" className="btn btn-primary min-h-10 px-5 text-sm font-semibold">
            Open roadmaps
          </Link>
          <Link to="/resources/certs" className="btn surface-muted min-h-10 px-5 text-sm font-semibold">
            Certifications & learning
          </Link>
        </div>
      </section>

      <section aria-labelledby="weekly-heading" className={sectionGap}>
        <h2 id="weekly-heading" className={sectionLabel}>
          Weekly job search system
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          High accountability, low ambiguity. Count outputs, not hours spent “looking.” Adjust quotas to your bandwidth;
          zero weeks are the enemy.
        </p>
        <ul className="mt-8 max-w-2xl space-y-5">
          {WEEKLY_SYSTEM.map(({ title, detail }) => (
            <li key={title} className="flex gap-4">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/[0.1] dark:border-white/[0.15]"
                aria-hidden
              >
                <Map className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </span>
              <div>
                <p className="font-semibold text-ink dark:text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tools-heading" className={sectionGap}>
        <h2 id="tools-heading" className={sectionLabel}>
          Execution tools
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Same growth system—different jobs. Track pipeline, pick markets wisely, and protect focus time.
        </p>
        {EXECUTION_TOOLS.map((group) => (
          <div key={group.id} className="mt-12 first:mt-10 sm:mt-14 sm:first:mt-12">
            <h3 className="text-lg font-semibold tracking-tight text-ink dark:text-white">{group.label}</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{group.intro}</p>
            <ul className="mt-6 border-t border-black/[0.07] dark:border-white/[0.09]" role="list">
              {group.tools.map((t) => (
                <ToolRow key={t.href} {...t} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="referrals-heading" className={sectionGap}>
        <h2 id="referrals-heading" className={sectionLabel}>
          Referrals & outreach
        </h2>
        <div className="mt-5 max-w-2xl space-y-4 text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          <p className="flex gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} aria-hidden />
            <span>
              Warm intros compress trust: a referrer vouches that you can do the work. They work best when you send a{" "}
              <span className="font-medium text-ink dark:text-white">one-page proof summary</span>—role target, two
              links, and one metric—so forwarding is effortless.
            </span>
          </p>
          <p>
            Cold outreach still matters: short, specific notes beat volume. Tie each message to a product detail, tech
            choice, or post—and end with a narrow ask (15-minute chat, not “pick your brain forever”).
          </p>
        </div>
      </section>

      <section aria-labelledby="progress-heading" className={sectionGap}>
        <h2 id="progress-heading" className={sectionLabel}>
          What progress looks like
        </h2>
        <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">Roadmap milestones checked off</span> with
              artifacts you can link from a résumé or interview.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">Stronger proof</span> in Build feeding better
              bullets and GitHub signals.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">More tailored applications</span>—fewer apps,
              higher match rate, clearer follow-ups.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">Better interview readiness</span> because stories
              match the repos and docs you shipped.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-ink dark:text-white">Consistent weekly execution</span> in trackers
              and calendar—not heroic sprints followed by silence.
            </span>
          </li>
        </ul>
        <p className="mt-10 text-sm text-ink-muted">
          Realign your path anytime in{" "}
          <Link
            to="/self-assessment"
            className="font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]"
          >
            Discover
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
