import React from "react";

type Props = {
  title: string;
  sub?: string;
  /** Optional short line under eyebrow (e.g. module context) */
  eyebrow?: string;
};

/**
 * Editorial page title: hierarchy via type + spacing, not a nested card shell.
 */
export default function PageHeader({ title, sub, eyebrow }: Props) {
  return (
    <header className="surface-hero mb-12 sm:mb-14">
      <p className="section-label">{eyebrow ?? "Roadmap to Role"}</p>
      <h1 className="mt-3 max-w-3xl text-balance text-title font-semibold tracking-tight text-ink dark:text-white sm:text-4xl sm:leading-[1.1]">
        {title}
      </h1>
      {sub ? (
        <p className="section-plain mt-4 text-body leading-relaxed text-ink-muted sm:mt-5 sm:text-lead">
          {sub}
        </p>
      ) : null}
    </header>
  );
}
