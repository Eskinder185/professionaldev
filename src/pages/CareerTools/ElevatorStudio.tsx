import React, { useMemo, useState } from "react";
import TeleprompterRecorder from "../../components/Elevator/TeleprompterRecorder";

export default function ElevatorStudio() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [goal, setGoal] = useState("");
  const script = useMemo(() => {
    if (!name || !role || !skills || !goal) return "Fill all fields to preview.";
    const s = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");
    return `${name} here—${role} focused on ${s}. I help ${goal}. Recently, I delivered a project that improved results—happy to share details. I’m excited about teams where I can contribute and keep learning.`;
  }, [name, role, skills, goal]);

  return (
    <div className="space-y-6">
      <header className="surface-muted p-5">
        <h1 className="text-2xl font-semibold brand-heading">Elevator Pitch Generator</h1>
        <p>Craft a crisp 30–45s pitch, then practice with a teleprompter and recording.</p>
      </header>

      <div className="surface p-5 grid md:grid-cols-2 gap-4">
        <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Desired role" value={role} onChange={(e) => setRole(e.target.value)} />
        <input className="input md:col-span-2" placeholder="Top skills (comma-separated)" value={skills} onChange={(e) => setSkills(e.target.value)} />
        <input className="input md:col-span-2" placeholder="Goal (e.g., help teams ship secure cloud apps)" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </div>

      <TeleprompterRecorder script={script} />
    </div>
  );
}

