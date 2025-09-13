import React from "react";
import Tile from "../../components/ui/Tile";

export default function ResourcesIndex() {
  return (
    <div className="space-y-6">
      <header className="surface-muted p-6 fade-up">
        <h1 className="brand-heading text-2xl font-semibold">Resources</h1>
        <p>Stay consistent and track momentum.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Tile
          title="Certifications & Learning"
          desc="Sequenced study paths, weekly plans, and practice links."
          tags={["roadmaps", "weekly plan"]}
          to="/resources/certs"
        />
        <Tile
          title="Skill & Job Trackers"
          desc="Log apps, OAs, interviews, and learning streaks. CSV import/export."
          tags={["CRM", "CSV", "reminders"]}
          to="/resources/trackers"
        />
        <Tile
          title="Time & Productivity"
          desc="Pomodoro with break ideas + PWA for commutes."
          tags={["pomodoro", "PWA", "focus"]}
          href="https://eskinder185.github.io/tasktracker/"
        />
        <Tile
          title="Job Sites"
          desc="Curated job boards with short descriptions and links."
          tags={["search", "remote", "tech"]}
          to="/Resources/JobSites"
        />
      </div>
    </div>
  );
}
