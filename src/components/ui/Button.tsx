import React from "react";
function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "subtle" | "ghost";
  size?: "sm" | "md";
};
export default function Button({ className, variant = "primary", size = "md", ...p }: Props) {
  const base = "inline-flex items-center gap-2 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-white/30";
  const v =
    variant === "primary"
      ? "bg-brand-500 hover:bg-brand-400 text-white border border-white/10"
      : variant === "subtle"
      ? "bg-white/10 hover:bg-white/15 text-white border border-white/10"
      : "bg-transparent hover:bg-white/5 text-white";
  const s = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2";
  return <button className={cn(base, v, s, className)} {...p} />;
}
