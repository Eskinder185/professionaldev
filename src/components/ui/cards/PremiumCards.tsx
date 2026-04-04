import React from "react";
import { Link } from "react-router-dom";
import { cardLayout } from "../../../theme/cardTokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type CardShellProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  muted?: boolean;
  size?: "md" | "lg";
};

/** Plain section block — no card frame */
export function CardShell({
  interactive,
  muted,
  className,
  children,
  ...rest
}: CardShellProps) {
  return (
    <div
      className={cn(
        "border-0 py-6 shadow-none sm:py-8",
        muted ? cardLayout.surfaceMuted : cardLayout.surface,
        interactive && cardLayout.interactive,
        "rounded-none",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardIconWell({
  className,
  children,
  compact,
}: {
  className?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center text-ink-muted",
        compact ? "h-10 w-10" : "h-11 w-11",
        className,
      )}
    >
      {children}
    </div>
  );
}

type FeatureCardProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function FeatureCard({ title, description, icon, footer, className }: FeatureCardProps) {
  return (
    <article className={cn("flex flex-col border-b border-black/[0.07] py-8 dark:border-white/[0.09] sm:py-10", className)}>
      {icon ? <div className="text-ink dark:text-white">{icon}</div> : null}
      <h3 className="mt-4 text-title-sm text-ink dark:text-white">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{description}</p>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </article>
  );
}

type ToolCardProps = {
  title: string;
  description: string;
  to: string;
  icon?: React.ReactNode;
  className?: string;
};

export function ToolCard({ title, description, to, icon, className }: ToolCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group -mx-1 flex gap-4 border-b border-black/[0.07] py-6 dark:border-white/[0.09] sm:gap-5 sm:py-8",
        cardLayout.interactive,
        cardLayout.focusRing,
        "rounded-sm px-1",
        className,
      )}
    >
      {icon ? (
        <CardIconWell compact className="text-ink-muted transition-colors group-hover:text-ink dark:group-hover:text-white">
          {icon}
        </CardIconWell>
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold tracking-tight text-ink dark:text-white">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
    </Link>
  );
}

type SectionSummaryCardProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export function SectionSummaryCard({
  eyebrow,
  title,
  description,
  children,
  className,
}: SectionSummaryCardProps) {
  return (
    <div className={cn("border-b border-black/[0.07] pb-12 dark:border-white/[0.09] sm:pb-14", className)}>
      <p className="section-label">{eyebrow}</p>
      <h2 className="mt-3 max-w-2xl text-title text-ink dark:text-white sm:text-4xl sm:leading-tight">{title}</h2>
      {description ? (
        <p className="section-plain mt-4 text-body leading-relaxed text-ink-muted sm:mt-5 sm:text-lead">{description}</p>
      ) : null}
      {children ? <div className={cn(description ? "mt-10" : "mt-8")}>{children}</div> : null}
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  progress?: { value: number; max: number };
  className?: string;
};

export function StatCard({ label, value, hint, progress, className }: StatCardProps) {
  const pct =
    progress && progress.max > 0 ? Math.min(100, Math.round((progress.value / progress.max) * 100)) : null;

  return (
    <div
      className={cn(
        "border-b border-black/[0.07] pb-10 last:border-b-0 last:pb-0 dark:border-white/[0.09] md:border-b-0 md:pb-0",
        className,
      )}
    >
      <p className="text-caption font-medium uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink dark:text-white sm:text-[1.75rem]">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-relaxed text-ink-muted">{hint}</p> : null}
      {pct !== null ? (
        <div className="mt-4">
          <div className="h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
            <div
              className="h-full rounded-full bg-[rgb(var(--tw-accent))] motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-caption text-ink-faint">
            {progress!.value} of {progress!.max}
          </p>
        </div>
      ) : null}
    </div>
  );
}

type CtaCardProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export function CtaCard({ title, description, children, className }: CtaCardProps) {
  return (
    <div className={cn("border-t border-black/[0.07] pt-12 dark:border-white/[0.09] sm:pt-14", className)}>
      <div className="relative max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-ink dark:text-white sm:text-4xl">{title}</h2>
        {description ? <p className="mt-4 text-lead text-ink-muted">{description}</p> : null}
        {children ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
