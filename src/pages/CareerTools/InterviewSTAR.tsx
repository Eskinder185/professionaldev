import { useState } from "react";
import SectionHeader from "../../components/SectionHeader";

export default function InterviewSTAR(){
  const [s, setS] = useState(""); const [t,setT]=useState("");
  const [a, setA] = useState(""); const [r,setR]=useState("");
  const result = s && t && a && r
    ? `In ${s}, my task was ${t}. I took action by ${a}. As a result, ${r}.`
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeader title="STAR Method Practice" subtitle="Generate a polished answer."/>
      <div className="grid gap-3">
        <input className="border p-2 rounded" placeholder="Situation" value={s} onChange={e=>setS(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Task" value={t} onChange={e=>setT(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Action" value={a} onChange={e=>setA(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Result" value={r} onChange={e=>setR(e.target.value)} />
      </div>
      <div className="mt-4">
        <div className="text-sm text-gray-600 mb-1">Your answer:</div>
        <div className="border rounded-xl p-3 bg-gray-50 min-h-[100px]">{result || "Fill all fields to preview."}</div>
      </div>
    </div>
  )
}
