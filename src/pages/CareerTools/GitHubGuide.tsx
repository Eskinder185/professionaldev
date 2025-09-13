
import React from "react";

const RepoReadmeTemplate = [
  '# Project Title',
  'Short value statement (what it does, for whom).',
  '',
  '## Demo',
  '• Live: https://…',
  '• Screenshots/GIFs',
  '',
  '## Tech',
  'React, TypeScript, Vite, Tailwind, … (list 3–6)',
  '',
  '## Setup',
  '```bash',
  'pnpm i',
  'pnpm dev',
  '```',
  '',
  '## Features',
  '- Key feature one (user benefit, not just tech)',
  '- Key feature two',
  '',
  '## Results',
  '- Perf: TTI -35%, bundle -40%',
  '- Users: +1.2k MAU',
  '',
  '## Roadmap',
  '- [ ] Next step 1',
  '- [ ] Next step 2',
].join('\n');

const ProfileReadmeTemplate = [
  "# Hi, I'm YOUR NAME 👋",
  'Frontend Engineer building fast, accessible web apps.',
  '',
  '- 🔭 Current: Frontend platform (Vite, SWC, Storybook)',
  '- 🌱 Learning: WebGL + performance profiling',
  '- 🧰 Stack: React · TypeScript · Node · Tailwind · AWS',
  '- 🔗 Portfolio: https://your-portfolio.site',
  '- ✉️ Contact: you@domain.com',
  '',
  '## Highlights',
  '- Shipped dashboard used by 10k+ users (NPS +18)',
  '- Cut CI pipeline from 14m → 6m (-57%)',
  '- Built design system used across 3 teams',
  '',
  '## Recent Projects',
  '[Project A](https://github.com/you/project-a) — brief 1-line what/impact',
  '[Project B](https://github.com/you/project-b) — brief 1-line what/impact',
].join('\n');

export default function GitHubGuide() {
  return (
    <div className="space-y-6">
      <header className="surface-muted p-6">
        <h1 className="brand-heading text-2xl font-semibold">GitHub Profile Guide</h1>
        <p>Stand out with a profile README, clean repos, and pinned projects that show impact.</p>
      </header>

      <section className="surface p-5 hover-glow" style={{ ["--glow" as any]:"var(--accent-orange)" }}>
        <h2 className="font-semibold text-lg">1) Create the special “profile repo”</h2>
        <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
          <li>Find your GitHub username (e.g., <b>eskinder185</b>).</li>
          <li><b>Create a new repo named exactly your username</b>: <code>eskinder185</code>.</li>
          <li>Initialize with a README. GitHub will mark it as your profile README.</li>
          <li>Edit the README with the template below, commit, and push.</li>
        </ol>
        <div className="surface-muted p-4 mt-3 rounded-xl">
          <h3 className="font-semibold mb-2">Profile README template</h3>
          <pre className="whitespace-pre-wrap text-sm">{ProfileReadmeTemplate}</pre>
        </div>
      </section>

      <section className="surface p-5 hover-glow" style={{ ["--glow" as any]:"var(--accent-blue)" }}>
        <h2 className="font-semibold text-lg">2) Pin 6 repos (show your best work)</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li>2 polished projects (live demo + screenshots).</li>
          <li>1–2 learning or clone repos (show growth and curiosity).</li>
          <li>1 library or tooling repo (e.g., hooks, components, CLI).</li>
          <li>Each pinned repo must have a clear README (see template below).</li>
        </ul>
      </section>

      <section className="surface p-5 hover-glow">
        <h2 className="font-semibold text-lg">3) Repo README structure</h2>
        <div className="surface-muted p-4 mt-3 rounded-xl">
          <pre className="whitespace-pre-wrap text-sm">{RepoReadmeTemplate}</pre>
        </div>
      </section>

      <section className="surface p-5 hover-glow">
        <h2 className="font-semibold text-lg">4) Hygiene & discoverability</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li><b>Topics</b>: add 4–8 keywords (react, typescript, vite, tailwind, …).</li>
          <li><b>Commits</b>: semantic style (<code>feat:</code>, <code>fix:</code>, <code>chore:</code>).</li>
          <li><b>Badges</b>: Shields.io for build, license, demo link.</li>
          <li><b>Screenshots</b>: put in <code>/public</code> or repo root; reference in README.</li>
          <li><b>Open Graph</b>: add a nice social preview image in repo settings.</li>
        </ul>
      </section>
    </div>
  );
}
