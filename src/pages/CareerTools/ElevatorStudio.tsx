import React, { useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import TeleprompterRecorder from "../../components/Elevator/TeleprompterRecorder";

const PLACEHOLDER = "Fill all fields to preview your pitch.";

export default function ElevatorStudio() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [goal, setGoal] = useState("");

  const script = useMemo(() => {
    if (!name.trim() || !role.trim() || !skills.trim() || !goal.trim()) return PLACEHOLDER;
    const s = skills
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");
    return `${name.trim()} here—${role.trim()} focused on ${s}. I help ${goal.trim()}. Recently, I delivered a project that improved results—happy to share details. I’m excited about teams where I can contribute and keep learning.`;
  }, [name, role, skills, goal]);

  const ready = script !== PLACEHOLDER;

  return (
    <div className="space-y-8 pb-6">
      <PageHeader
        eyebrow="Career Tools"
        title="Elevator Pitch Generator"
        sub="Answer four prompts and we’ll assemble a 30–45 second script. Scroll it like a teleprompter and record yourself until it sounds natural — all in the browser."
      />

      <section className="space-y-6 border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12">
        <div>
          <h2 className="text-title-sm text-ink dark:text-white">Build your script</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Use first name or how you introduce yourself. Skills can be a short comma list; we use up to four items in the pitch.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="elev-name" className="text-sm font-medium text-ink dark:text-white">
              How you introduce yourself
            </label>
            <input
              id="elev-name"
              className="input"
              placeholder="e.g. Jordan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="elev-role" className="text-sm font-medium text-ink dark:text-white">
              Target role
            </label>
            <input
              id="elev-role"
              className="input"
              placeholder="e.g. senior frontend engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="elev-skills" className="text-sm font-medium text-ink dark:text-white">
              Top skills or themes
            </label>
            <input
              id="elev-skills"
              className="input"
              placeholder="e.g. React, accessibility, design systems, performance"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
            <p className="text-caption text-ink-muted">Comma-separated. The first few appear in the generated line.</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="elev-goal" className="text-sm font-medium text-ink dark:text-white">
              Who you help or what you drive toward
            </label>
            <input
              id="elev-goal"
              className="input"
              placeholder="e.g. teams ship accessible, fast web apps with confidence"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
        </div>

        {!ready ? (
          <EmptyState
            title="Script preview is waiting"
            hint="Complete all four fields to generate text for the teleprompter below."
          />
        ) : (
          <div className="border-l-2 border-accent/40 py-2 pl-4">
            <p className="text-caption font-medium uppercase tracking-wide text-ink-muted">Draft pitch</p>
            <p className="mt-2 text-body leading-relaxed text-ink dark:text-white/90">{script}</p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="px-1">
          <h2 className="text-title-sm text-ink dark:text-white">Teleprompter &amp; recording</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Tune scroll speed and font size, then practice aloud. Grant camera access only when you start a recording.
          </p>
        </div>
        <TeleprompterRecorder script={script} scriptReady={ready} />
      </section>
    </div>
  );
}
