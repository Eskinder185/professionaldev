import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SectionShell from "./SectionShell";
import { CtaCard } from "../ui/cards";

export default function HomeFinalCta() {
  return (
    <SectionShell className="pb-28 md:pb-32 lg:pb-36">
      <CtaCard
        title="Continue your roadmap"
        description="Pick up where you left off: clarify fit in Discover, or push your résumé, repos, and stories forward in Build. The next offer is built from the next proof point."
      >
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/self-assessment"
              className="btn btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-7 py-3 text-base font-semibold sm:min-h-11"
            >
              Start with Discover
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/career-tools"
              className="btn inline-flex min-h-12 items-center justify-center px-7 py-3 text-base font-semibold sm:min-h-11"
            >
              Continue building proof
            </Link>
          </div>
          <p className="text-sm text-ink-muted">
            <Link
              to="/contact"
              className="font-medium text-ink underline-offset-4 hover:underline dark:text-white/85"
            >
              Contact
            </Link>
            <span className="text-ink-faint"> · </span>
            <span>Questions, bugs, or feedback—we read every note.</span>
          </p>
        </div>
      </CtaCard>
    </SectionShell>
  );
}
