import React from "react";
import { Link } from "react-router-dom";
import { Github, Globe, Linkedin, Mail } from "lucide-react";
import { SITE_CONTACT } from "../../data/siteContact";

const iconLinkClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] dark:hover:text-white";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-black/5 bg-canvas/80 py-10 backdrop-blur-xl dark:border-white/[0.06]">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="max-w-prose">
            <p className="text-sm font-semibold text-ink dark:text-white">Roadmap to Role</p>
            <p className="mt-1 text-sm text-ink-muted">
              Discover strengths, build proof, and grow into the role you want — with clarity and
              structure.
            </p>
            <ul
              className="mt-5 flex flex-wrap items-center gap-1 sm:gap-2"
              role="list"
              aria-label={`${SITE_CONTACT.name} — social and contact`}
            >
              <li>
                <a
                  href={SITE_CONTACT.portfolio}
                  className={iconLinkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${SITE_CONTACT.name} portfolio (opens in a new tab)`}
                >
                  <Globe className="h-5 w-5" aria-hidden />
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE_CONTACT.email}`}
                  className={iconLinkClass}
                  aria-label={`Email ${SITE_CONTACT.email}`}
                >
                  <Mail className="h-5 w-5" aria-hidden />
                </a>
              </li>
              <li>
                <a
                  href={SITE_CONTACT.linkedin}
                  className={iconLinkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${SITE_CONTACT.name} on LinkedIn (opens in a new tab)`}
                >
                  <Linkedin className="h-5 w-5" aria-hidden />
                </a>
              </li>
              <li>
                <a
                  href={SITE_CONTACT.github}
                  className={iconLinkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${SITE_CONTACT.name} on GitHub (opens in a new tab)`}
                >
                  <Github className="h-5 w-5" aria-hidden />
                </a>
              </li>
            </ul>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted" aria-label="Footer">
            <Link
              to="/about"
              className="rounded-sm transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] dark:hover:text-white"
            >
              About
            </Link>
            <Link
              to="/tech-career-hub"
              className="rounded-sm transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] dark:hover:text-white"
            >
              Tech Hub
            </Link>
            <Link
              to="/contact"
              className="rounded-sm transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] dark:hover:text-white"
            >
              Contact
            </Link>
            <Link
              to="/settings"
              className="rounded-sm transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] dark:hover:text-white"
            >
              Settings
            </Link>
          </nav>

          <p className="text-caption text-ink-faint md:shrink-0 md:text-right">
            © {new Date().getFullYear()} Roadmap to Role
          </p>
        </div>
      </div>
    </footer>
  );
}
