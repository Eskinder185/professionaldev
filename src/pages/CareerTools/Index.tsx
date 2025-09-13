import React from "react";
import FeatureSection from "../../components/FeatureSection";

export default function CareerTools() {
  const items = [
    {
      title: "Résumé Grader",
      blurb: "Upload or paste your résumé for an ATS-style score and suggestions.",
      href: "/career-tools/resume-grader",
      accent: "blue",
      tags: ["ATS", "metrics", "impact"],
      details: [
        "Section order & formatting tips",
        "Strong action verbs",
        "Quantify outcomes",
        "Instant feedback on clarity and impact"
      ],
    },
    {
      title: "LinkedIn Guide",
      blurb: "Exact formatting for headline, About, Experience, Featured, and settings.",
      href: "/career-tools/linkedin",
      accent: "purple",
      tags: ["branding", "profile", "networking"],
      details: [],
    },
    {
      title: "GitHub Profile Guide",
      blurb: "Set up the special profile repo, pin projects, and write clean READMEs.",
      href: "/career-tools/github",
      accent: "orange",
      tags: ["profile README", "pinned repos", "badges"],
      details: [],
    },
    {
      title: "Behavioral Q&A (STAR/CARL)",
      blurb: "Practice real questions and craft concise, metric-driven stories.",
      href: "/career-tools/behavioral",
      accent: "purple",
      tags: ["STAR", "CARL", "prep"],
      details: ["18 common questions", "Live preview", "Video recording", "Autosave drafts"],
    },
    {
      title: "Elevator pitch studio",
      blurb: "Write a crisp 30–60s pitch, then practice with teleprompter + recording.",
      href: "/career-tools/elevator-studio",
      accent: "orange",
      tags: ["clarity", "brevity", "practice"],
      details: ["Teleprompter", "Recording", "Quick variants"],
    },
    {
      title: "Portfolio & GitHub",
      blurb: "Showcase projects with clean READMEs, demos, and commit hygiene.",
      href: "/career-tools/portfolio",
      accent: "emerald",
      tags: ["projects", "readme", "demos"],
      details: ["Project highlights", "Live demo links", "Contributor habits"],
    },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="surface-muted p-6">
        <h1 className="brand-heading text-2xl font-semibold">Career Tools</h1>
        <p>Guides and helpers to present your best work.</p>
      </header>

      <div className="relative">
        <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
          <FeatureSection heading="" items={items as any} />
        </div>
      </div>
    </div>
  );
}
