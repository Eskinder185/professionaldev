import React from "react";
import SectionHeader from "../../components/SectionHeader";
import FeatureSection from "../../components/FeatureSection";

export default function CareerTools() {
  const items = [
    {
      title: "Resume & LinkedIn",
      blurb: "Polish your resume and profile with impact bullets and clean structure.",
      href: "/career-tools/resume-grader",
      accent: "blue",
      tags: ["structure", "impact", "profile"],
      details: ["Section order & formatting tips", "Strong action verbs", "Quantify outcomes"],
    },
    {
      title: "STAR/CARL Stories",
      blurb: "Craft Situation/Task/Action/Result stories recruiters remember (or CARL).",
      href: "/career-tools/stories",
      accent: "purple",
      tags: ["behavioral", "stories", "metrics"],
      details: ["Guided prompts", "Concise outcomes", "Reusable templates"],
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
    <div className="relative">
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <SectionHeader title="Career Tools" subtitle="Guides and helpers to present your best work." />
        <FeatureSection heading="" items={items as any} />
      </div>
    </div>
  );
}
