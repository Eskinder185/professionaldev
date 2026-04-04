import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cardLayout } from "../../theme/cardTokens";

function cn(...p: (string | false | null | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

function HubTag({ children }: { children: React.ReactNode }) {
  return <span className="text-caption text-ink-faint">{children}</span>;
}

export type HubCardProps = {
  title: string;
  description: string;
  tags?: string[];
  to?: string;
  href?: string;
  ctaLabel?: string;
  icon?: React.ReactNode;
  details?: string[];
  className?: string;
};

/** Hub row: editorial list item — hairline divider, no card shell */
export default function HubCard({
  title,
  description,
  tags,
  to,
  href,
  ctaLabel = "Open",
  icon,
  details,
  className,
}: HubCardProps) {
  const meta = (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-faint">
      <span className="font-medium text-accent">{ctaLabel}</span>
      {tags?.length ? (
        <>
          <span aria-hidden className="text-ink-faint/40">
            ·
          </span>
          {tags.map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 ? (
                <span aria-hidden className="text-ink-faint/40">
                  ·
                </span>
              ) : null}
              <HubTag>{t}</HubTag>
            </React.Fragment>
          ))}
        </>
      ) : null}
    </div>
  );

  const body = (
    <>
      <div className="flex gap-4 sm:gap-5">
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center text-ink-muted transition-colors group-hover:text-ink dark:group-hover:text-white">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight text-ink dark:text-white">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>
          {details?.length ? (
            <ul className="mt-3 space-y-1 text-sm text-ink-muted/90">
              {details.map((d, i) => (
                <li key={i} className="flex gap-2 pl-0.5">
                  <span className="text-ink-faint" aria-hidden>
                    ·
                  </span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {meta}
        </div>
        <ArrowRight
          className="mt-1 h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink-muted motion-reduce:transform-none dark:group-hover:text-white/70"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    </>
  );

  const shell = cn(
    "group -mx-1 block border-b border-black/[0.07] py-6 text-left dark:border-white/[0.09] sm:py-8",
    cardLayout.interactive,
    cardLayout.focusRing,
    "rounded-sm px-1",
    className,
  );

  if (href) {
    return (
      <a href={href} className={shell} target="_blank" rel="noopener noreferrer" aria-label={`${title} (opens in a new tab)`}>
        {body}
      </a>
    );
  }

  return (
    <Link to={to || "#"} className={shell}>
      {body}
    </Link>
  );
}
