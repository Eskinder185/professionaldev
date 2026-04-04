import React from "react";
import SectionShell from "./SectionShell";
import { SectionSummaryCard, StatCard } from "../ui/cards";

const stats = [
  {
    label: "Evidence over intention",
    value: "Ship artifacts",
    hint: "Every module nudges you toward output: a scored résumé, a tightened story, a logged application. Intent without proof doesn’t survive screening.",
  },
  {
    label: "Optimize the first minute",
    value: "Screening-first",
    hint: "Résumé parsers, LinkedIn previews, and GitHub pins get seconds. The system is tuned so your strongest signal shows up before the scroll.",
  },
  {
    label: "Structure beats randomness",
    value: "One repeatable loop",
    hint: "Discover → Build → Grow is the same backbone whether you’re pivoting or leveling up—less reinvention, more compounding progress.",
  },
] as const;

export default function HomeProgressValue() {
  return (
    <SectionShell className="border-t border-black/5 dark:border-white/[0.06] !pt-14 md:!pt-[4.5rem]">
      <SectionSummaryCard
        eyebrow="Principles"
        title="How we think about career work"
        description="Premium doesn’t mean noisy. It means disciplined defaults: evidence-forward, recruiter-realistic, and structured so your effort shows up where it counts."
      >
        <div className="grid gap-0 border-t border-black/[0.07] pt-12 dark:border-white/[0.09] md:grid-cols-3 md:gap-10 md:pt-14 lg:gap-12">
          {stats.map(({ label, value, hint }) => (
            <StatCard key={label} label={label} value={value} hint={hint} />
          ))}
        </div>
      </SectionSummaryCard>
    </SectionShell>
  );
}
