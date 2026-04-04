import React from "react";
import { useTheme } from "../theme/ThemeProvider";

function cn(...a: (string | undefined | false)[]) {
  return a.filter(Boolean).join(" ");
}

function IconSun(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" aria-hidden {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function IconMoon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" aria-hidden {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

type Props = {
  /** Icon-only control for dense toolbars (nav). */
  compact?: boolean;
  className?: string;
};

export default function ThemeToggle({ compact, className }: Props) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";
  const label = isLight ? "Switch to dark appearance" : "Switch to light appearance";

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isLight}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-200",
          "hover:bg-black/[0.06] hover:text-ink",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]",
          "dark:hover:bg-white/[0.08] dark:hover:text-white",
          className,
        )}
      >
        {isLight ? <IconMoon /> : <IconSun />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isLight}
      title={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-medium text-ink-muted transition-colors duration-200",
        "hover:bg-black/[0.06] hover:text-ink",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]",
        "dark:border-white/10 dark:bg-white/[0.06] dark:text-ink-muted dark:hover:bg-white/[0.1] dark:hover:text-white",
        className,
      )}
    >
      {isLight ? <IconMoon /> : <IconSun />}
      <span className="hidden sm:inline">{isLight ? "Dark" : "Light"}</span>
    </button>
  );
}
