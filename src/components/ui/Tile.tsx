import React from "react";
import HubCard from "./HubCard";
import { BookOpen, Briefcase, Clock, Globe } from "lucide-react";

const FALLBACK_ICONS = [BookOpen, Briefcase, Clock, Globe] as const;

/**
 * @deprecated Prefer `HubCard` directly. Wrapper kept for older imports.
 */
export default function Tile({
  title,
  desc,
  tags,
  to,
  href,
  className = "",
}: {
  title: string;
  desc: string;
  tags?: string[];
  to?: string;
  href?: string;
  className?: string;
}) {
  const Icon = FALLBACK_ICONS[Math.abs(title.length) % FALLBACK_ICONS.length];
  return (
    <HubCard
      title={title}
      description={desc}
      tags={tags}
      to={to}
      href={href}
      ctaLabel={href ? "Open link" : "Open"}
      className={className}
      icon={<Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
    />
  );
}
