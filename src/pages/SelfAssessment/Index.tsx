import React from "react";
import FeatureSection from "../../components/FeatureSection";

export default function SelfAssessment() {
  const items = [
    {
      title: "Strengths & Weaknesses Test",
      blurb:
        "15-minute quiz (Big-Five style) with a printable radar chart and personalized study plan.",
      href: "/self/strengths",
      icon: "Activity",
      accent: "orange",
      tags: ["15 min", "radar chart", "study plan"],
      details: [
        "Measures focus, communication, ownership, pace",
        "Outputs top 3 strengths + 3 blind spots",
        "Auto-links to matching roles in Roadmap",
      ],
    },
    {
      title: "Core Values Workshop",
      blurb:
        "Rank your top 10 values, compare trade-offs, and craft a 2-line 'job filter' statement.",
      href: "/self/values",
      icon: "HeartHandshake",
      accent: "emerald",
      tags: ["rank", "reflect", "export"],
      details: [
        "Drag-to-rank cards (autosave)",
        "Conflict prompts: time vs money, freedom vs stability",
        "Exports a 'What I accept / What I avoid' PDF",
      ],
    },
    {
      title: "Career Interests Map",
      blurb:
        "Short quiz that maps you to role tracks (Frontend, Cloud/DevOps, Cloud Sec) with starter steps.",
      href: "/self/interests",
      icon: "Map",
      accent: "blue",
      tags: ["quiz", "role match"],
      details: [
        "6 scenario questions → role vector",
        "Shows 3 sample job postings to compare",
        "Links into Roadmap milestones",
      ],
    },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="surface-muted p-6">
        <h1 className="brand-heading text-2xl font-semibold">Self-Assessment</h1>
        <p>Know yourself → choose the right path.</p>
      </header>

      <div className="relative">
        <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
          <FeatureSection heading="" items={items as any} />
        </div>
      </div>
    </div>
  );
}
