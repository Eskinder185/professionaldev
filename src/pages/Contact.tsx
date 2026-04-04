import React, { useState } from "react";
import { ArrowUpRight, ChevronRight, Github, Globe, Linkedin, Mail, Send } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { SITE_CONTACT } from "../data/siteContact";

const sectionLabel = "text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted";

type Channel = {
  href: string;
  label: string;
  hint: string;
  Icon: typeof Mail;
  external?: boolean;
};

const CHANNELS: Channel[] = [
  {
    href: SITE_CONTACT.portfolio,
    label: "Portfolio",
    hint: "Projects and background",
    Icon: Globe,
    external: true,
  },
  {
    href: `mailto:${SITE_CONTACT.email}`,
    label: "Email",
    hint: SITE_CONTACT.email,
    Icon: Mail,
  },
  {
    href: SITE_CONTACT.linkedin,
    label: "LinkedIn",
    hint: "Connect professionally",
    Icon: Linkedin,
    external: true,
  },
  {
    href: SITE_CONTACT.github,
    label: "GitHub",
    hint: "Code and contributions",
    Icon: Github,
    external: true,
  },
];

export default function Contact() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [touched, setTouched] = useState(false);

  const canSend = email.trim().length > 3 && subject.trim().length > 0 && message.trim().length > 0;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSend) return;
    setSent(true);
    setEmail("");
    setSubject("");
    setMessage("");
    window.setTimeout(() => setSent(false), 6000);
  }

  return (
    <div className="pb-20 sm:pb-24">
      <PageHeader
        eyebrow="Support"
        title="Contact"
        sub="ProfessionalDev is built for people taking job search seriously. Use this page for product questions, feedback on the experience, feature ideas, or collaboration—we read what you send and use it to improve the platform. Prefer a direct line? Use email or the links beside the form."
      />

      <div className="mt-2 border-t border-black/[0.07] pt-12 dark:border-white/[0.09] sm:pt-14">
        <div className="grid grid-cols-1 gap-14 md:grid-cols-2 md:gap-16 lg:gap-20 md:items-start">
          <section aria-labelledby="contact-form-heading">
            <p className={sectionLabel} id="contact-form-intro">
              Message
            </p>
            <h2 id="contact-form-heading" className="mt-3 text-xl font-semibold tracking-tight text-ink dark:text-white sm:text-2xl">
              Send a note
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
              The form below is a front-end demo—nothing is sent to a server yet. For a real conversation, use{" "}
              <a
                href={`mailto:${SITE_CONTACT.email}`}
                className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]"
              >
                email
              </a>{" "}
              or open a channel on the right.
            </p>

            <form className="mt-10 space-y-6" onSubmit={onSubmit} noValidate aria-describedby="contact-form-intro">
              <div className="space-y-1.5">
                <label htmlFor="contact-email" className="block">
                  <span className="text-sm font-medium text-ink dark:text-white">Your email</span>
                  <span className="mt-0.5 block text-caption text-ink-faint">So we can reply if the product is wired to email later.</span>
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  className="input min-h-11 w-full"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-subject" className="block">
                  <span className="text-sm font-medium text-ink dark:text-white">Subject</span>
                  <span className="mt-0.5 block text-caption text-ink-faint">One line: question, feedback, idea, or partnership.</span>
                </label>
                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  className="input min-h-11 w-full"
                  placeholder="e.g. Suggestion for the résumé grader"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-message" className="block">
                  <span className="text-sm font-medium text-ink dark:text-white">Message</span>
                  <span className="mt-0.5 block text-caption text-ink-faint">
                    Enough context for a useful reply—screen, browser, or path (Discover / Build / Grow) if relevant.
                  </span>
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  className="textarea min-h-[160px] w-full"
                  placeholder="What would help you move forward?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {touched && !canSend ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  Add a valid email, subject, and a short message to continue.
                </p>
              ) : null}

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:gap-4">
                <button
                  type="submit"
                  className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-6 font-semibold sm:w-auto"
                >
                  <Send className="h-4 w-4 shrink-0" aria-hidden />
                  Send message
                </button>
                {sent ? (
                  <p className="text-sm font-medium text-accent" role="status">
                    Received—this build only confirms on screen. Connect a backend or mailto to deliver for real.
                  </p>
                ) : null}
              </div>
            </form>
          </section>

          <section aria-labelledby="connect-heading" className="md:border-l md:border-black/[0.07] md:pl-10 lg:pl-14 dark:md:border-white/[0.09]">
            <p className={sectionLabel}>Direct</p>
            <h2 id="connect-heading" className="mt-3 text-xl font-semibold tracking-tight text-ink dark:text-white sm:text-2xl">
              Connect
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
              Mail opens your client; other links open in a new tab. Use whichever channel fits the conversation.
            </p>

            <ul className="mt-10 space-y-0" role="list">
              {CHANNELS.map(({ href, label, hint, Icon, external }) => (
                <li key={label} className="border-t border-black/[0.06] first:border-t-0 dark:border-white/[0.08]">
                  <a
                    href={href}
                    className="group -mx-1 flex items-center justify-between gap-4 px-1 py-5 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] sm:py-5"
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    aria-label={
                      external
                        ? `${label} (${SITE_CONTACT.name}, opens in a new tab)`
                        : `${label}: ${hint}`
                    }
                  >
                    <span className="flex min-w-0 items-start gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center text-ink-muted transition-colors group-hover:text-ink dark:group-hover:text-white">
                        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-semibold text-ink dark:text-white">{label}</span>
                        <span className="mt-0.5 block text-caption text-ink-muted">{hint}</span>
                      </span>
                    </span>
                    {external ? (
                      <ArrowUpRight
                        className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-ink-muted dark:group-hover:text-white/60"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-ink-muted dark:group-hover:text-white/50"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
