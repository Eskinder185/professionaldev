import React from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "subtle" | "ghost";
  size?: "sm" | "md";
};

export default function Button({ className, variant = "primary", size = "md", ...p }: Props) {
  const base =
    "inline-flex items-center gap-2 rounded-xl font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const v =
    variant === "primary"
      ? "btn-primary border-transparent px-4 py-2 text-sm text-white"
      : variant === "subtle"
        ? "border border-black/10 bg-black/[0.03] px-4 py-2 text-sm text-ink hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
        : "border-transparent bg-transparent px-4 py-2 text-sm text-ink-muted hover:bg-black/[0.04] hover:text-ink dark:text-ink-muted dark:hover:bg-white/[0.06] dark:hover:text-white";
  const s = size === "sm" ? "px-3 py-1.5 text-xs" : "";
  return <button className={cn(base, v, size === "sm" ? s : "", className)} {...p} />;
}
