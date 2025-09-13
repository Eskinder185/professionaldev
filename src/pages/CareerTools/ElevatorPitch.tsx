import { useState } from "react";
import SectionHeader from "../../components/SectionHeader";

export default function ElevatorPitch(){
  const [name,setName]=useState(""); const [role,setRole]=useState("");
  const [skills,setSkills]=useState(""); const [goal,setGoal]=useState("");
  const pitch = name && role && skills && goal
   ? `Hi, I'm ${name}, a ${role}. I specialize in ${skills}. I'm looking to ${goal}.`
   : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeader title="Elevator Pitch Generator" subtitle="30-second intro you can refine."/>
      <div className="grid gap-3">
        <input className="border p-2 rounded" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Desired role" value={role} onChange={e=>setRole(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Top skills (comma-separated)" value={skills} onChange={e=>setSkills(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Goal (e.g., 'help teams ship secure cloud apps')" value={goal} onChange={e=>setGoal(e.target.value)} />
      </div>
      <div className="mt-4">
        <div className="text-sm text-gray-600 mb-1">Your pitch:</div>
        <div className="surface-muted p-3 min-h-[100px]">{pitch || "Fill all fields to preview."}</div>
      </div>
    </div>
  )
}
