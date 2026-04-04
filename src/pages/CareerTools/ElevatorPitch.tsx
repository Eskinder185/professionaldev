import { useState } from "react";
import PageHeader from "../../components/ui/PageHeader";

export default function ElevatorPitch() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [goal, setGoal] = useState("");
  const pitch =
    name && role && skills && goal
      ? `Hi, I'm ${name}, a ${role}. I specialize in ${skills}. I'm looking to ${goal}.`
      : "";

  return (
    <div className="space-y-0">
      <PageHeader
        eyebrow="Career Tools"
        title="Elevator Pitch Generator"
        sub="A 30-second intro you can refine."
      />

      <section className="border-t border-border/70 pt-8 sm:pt-10">
        <div className="grid max-w-3xl gap-3">
          <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Desired role" value={role} onChange={(e) => setRole(e.target.value)} />
          <input
            className="input"
            placeholder="Top skills (comma-separated)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
          <input
            className="input"
            placeholder="Goal (e.g., 'help teams ship secure cloud apps')"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
        <div className="mt-6 max-w-3xl">
          <div className="text-sm text-ink-muted mb-2">Your pitch</div>
          <div className="surface-emphasis border-l-4 border-l-[var(--accent-pink)] min-h-[100px] p-4 text-body">
            {pitch || "Fill all fields to preview."}
          </div>
        </div>
      </section>
    </div>
  );
}
