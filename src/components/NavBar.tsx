import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { Menu, X } from "lucide-react";

/**
 * Primary IA (left → right): hub → story → Discover / Build / Grow loop → contact → preferences.
 * Shorter labels reduce visual weight; `ariaLabel` keeps tasks clear for assistive tech.
 */
const PRIMARY_NAV: {
  to: string;
  label: string;
  end?: boolean;
  ariaLabel?: string;
}[] = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "CareerOS", ariaLabel: "Open CareerOS workspace" },
  { to: "/about", label: "About", ariaLabel: "About ProfessionalDev CareerOS" },
  { to: "/self-assessment", label: "Discover", ariaLabel: "Discover: self-assessment" },
  { to: "/career-tools", label: "Build", ariaLabel: "Build: career tools" },
  { to: "/resources", label: "Grow", ariaLabel: "Grow: resources and trackers" },
  { to: "/tech-career-hub", label: "Tech Hub", ariaLabel: "Tech Career Hub: CS and tech career paths" },
  { to: "/contact", label: "Contact" },
];

const UTILITY_NAV = [{ to: "/settings", label: "Settings", ariaLabel: "App settings" }] as const;

function desktopLinkClass({ isActive }: { isActive: boolean }) {
  return [
    "relative rounded-full px-3.5 py-2 text-[13px] font-medium leading-none tracking-[-0.01em]",
    "transition-[color,background-color,box-shadow] duration-200 ease-out",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]",
    isActive
      ? "bg-[rgb(var(--tw-ink))] text-[rgb(var(--tw-canvas))] shadow-sm"
      : "text-ink-muted hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/[0.07] dark:hover:text-white",
  ].join(" ");
}

function mobileLinkClass({ isActive }: { isActive: boolean }) {
  return [
    "block rounded-xl px-4 py-3.5 text-[15px] font-medium leading-snug tracking-[-0.01em]",
    "transition-colors duration-200",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]",
    isActive
      ? "bg-[rgb(var(--tw-ink))] text-[rgb(var(--tw-canvas))]"
      : "text-ink-muted hover:bg-black/[0.04] hover:text-ink active:bg-black/[0.06] dark:hover:bg-white/[0.06] dark:active:bg-white/[0.08]",
  ].join(" ");
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const sel = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(sel)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
}

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navLabelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const shell = headerRef.current;
    const panel = mobilePanelRef.current;

    const panelFocusables = getFocusableElements(panel);
    const firstInPanel = panelFocusables[0];
    if (firstInPanel) firstInPanel.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        menuButtonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !shell || !panel) return;

      const menuBtn = menuButtonRef.current;
      const inPanel = getFocusableElements(panel);
      const ring = [menuBtn, ...inPanel].filter(Boolean) as HTMLElement[];
      if (ring.length === 0) return;

      const firstEl = ring[0];
      const lastEl = ring[ring.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-black/[0.08] bg-canvas/[0.76] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/[0.07] dark:bg-canvas/[0.72]"
    >
      <nav
        className="mx-auto flex h-[3.25rem] max-w-content items-center gap-4 px-4 sm:h-14 sm:px-6"
        aria-labelledby={navLabelId}
      >
        <span id={navLabelId} className="sr-only">
          Primary navigation
        </span>

        {/* Brand */}
        <Link
          to="/"
          tabIndex={open ? -1 : undefined}
          className="group mr-auto flex min-w-0 shrink items-baseline gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--tw-accent))] sm:mr-0"
          onClick={close}
        >
          <span className="truncate text-[15px] font-semibold tracking-[-0.03em] text-ink dark:text-white">
            ProfessionalDev CareerOS
          </span>
          <span className="hidden text-[13px] font-normal tracking-[-0.01em] text-ink-muted sm:inline dark:text-ink-muted">
            <span className="text-ink-faint/80 dark:text-white/25" aria-hidden>
              ·
            </span>
            <span className="ml-2">Career studio</span>
          </span>
        </Link>

        {/* Desktop: primary links */}
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={desktopLinkClass}
              end={item.end}
              {...(item.ariaLabel ? { "aria-label": item.ariaLabel } : {})}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Desktop: utility + appearance */}
        <div className="hidden items-center gap-1 lg:flex">
          {UTILITY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={desktopLinkClass}
              {...(item.ariaLabel ? { "aria-label": item.ariaLabel } : {})}
            >
              {item.label}
            </NavLink>
          ))}
          <div className="ml-1 flex items-center pl-2">
            <div className="h-4 w-px shrink-0 bg-black/10 dark:bg-white/12" aria-hidden />
            <ThemeToggle compact className="ml-2" />
          </div>
        </div>

        {/* Mobile: theme in bar when closed; when menu is open, theme moves into the panel for a proper focus loop */}
        <div className="flex items-center gap-1 lg:hidden">
          {!open ? <ThemeToggle compact /> : null}
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-200 hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] dark:text-white dark:hover:bg-white/[0.08]"
            aria-expanded={open}
            aria-controls="primary-nav-mobile-panel"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" strokeWidth={1.75} aria-hidden /> : <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      {open ? (
        <div
          ref={mobilePanelRef}
          id="primary-nav-mobile-panel"
          className="border-t border-black/[0.08] bg-canvas/[0.92] backdrop-blur-2xl dark:border-white/[0.07] dark:bg-canvas/[0.88] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="mx-auto max-w-content px-4 py-4 sm:px-6">
            <ul className="space-y-1" role="list">
              {PRIMARY_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={mobileLinkClass}
                    end={item.end}
                    {...(item.ariaLabel ? { "aria-label": item.ariaLabel } : {})}
                    onClick={close}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Preferences
              </p>
              <ul className="space-y-1" role="list">
                {UTILITY_NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={mobileLinkClass}
                      {...(item.ariaLabel ? { "aria-label": item.ariaLabel } : {})}
                      onClick={close}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <span className="text-sm font-medium text-ink dark:text-white">Appearance</span>
                <ThemeToggle compact />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
