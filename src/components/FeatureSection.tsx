import React from "react";
import HubCard from "./ui/HubCard";
import { Activity, HeartHandshake, Map, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Activity,
  HeartHandshake,
  Map,
};

type Item = {
  title: string;
  blurb: string;
  href: string;
  icon?: string;
  tags?: string[];
  details?: string[];
  accent?: "orange" | "blue" | "purple" | "emerald";
};

export default function FeatureSection({
  heading,
  subheading,
  items,
}: {
  heading: string;
  subheading?: string;
  items: Item[];
}) {
  return (
    <section className="relative" aria-label={heading || "Tools and resources"}>
      {(heading || subheading) && (
        <div className="mb-8 border-b border-black/[0.07] pb-8 dark:border-white/[0.09] sm:mb-10 sm:pb-10">
          {heading ? (
            <h2 className="text-2xl font-semibold tracking-tight text-ink dark:text-white sm:text-3xl">{heading}</h2>
          ) : null}
          {subheading ? <p className="mt-3 max-w-prose text-body text-ink-muted">{subheading}</p> : null}
        </div>
      )}

      <ul className="border-t border-black/[0.07] dark:border-white/[0.09]">
        {items.map((it, idx) => {
          const Lucide = (it.icon && ICONS[it.icon]) || Sparkles;
          return (
            <li key={idx}>
              <HubCard
                title={it.title}
                description={it.blurb}
                to={it.href}
                tags={it.tags}
                details={it.details}
                ctaLabel="Open"
                icon={<Lucide className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
