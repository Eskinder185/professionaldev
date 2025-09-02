import { useState } from "react";
import SectionHeader from "../../components/SectionHeader";

const QUESTIONS = [
  {text:"I enjoy setting up cloud infrastructure.", tag:"Cloud"},
  {text:"I like finding and fixing vulnerabilities.", tag:"Cybersecurity"},
  {text:"I love building UI and animations.", tag:"Frontend"},
  {text:"I prefer building APIs and databases.", tag:"Backend"},
  {text:"I’m excited by data, charts, and ML.", tag:"Data/AI"}
];

export default function InterestsQuiz(){
  const [scores, setScores] = useState<Record<string,number>>({});
  function add(tag:string, v:number){
    setScores(s => ({...s, [tag]: (s[tag]||0)+v}));
  }
  const top = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeader title="Career Interests" subtitle="Vote +1 for what excites you."/>
      <ul className="space-y-4">
        {QUESTIONS.map((q,i)=>(
          <li key={i} className="border rounded-xl p-4 flex items-center justify-between gap-3">
            <span>{q.text}</span>
            <div className="flex gap-2">
              <button onClick={()=>add(q.tag,1)} className="px-3 py-1 rounded border">+1</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 text-gray-700">
        {top ? <>Top suggestion: <b>{top}</b></> : "Answer a few to see a suggestion."}
      </div>
    </div>
  )
}
