import { useState } from "react";
import SectionHeader from "../../components/SectionHeader";

const QUESTIONS = [
  "I prefer solving ambiguous problems.",
  "I enjoy collaborating and explaining ideas to others.",
  "I like working with data and metrics.",
  "I stay calm and focused under pressure."
];

export default function StrengthsQuiz(){
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(3));
  const [saved, setSaved] = useState(false);

  function save(){
    localStorage.setItem("pd_strengths_quiz", JSON.stringify(answers));
    setSaved(true);
    setTimeout(()=>setSaved(false),1500);
  }

  function scoreAdvice(){
    const avg = answers.reduce((a,b)=>a+b,0)/answers.length;
    if (avg >= 4) return "You lean toward leadership/collaboration roles.";
    if (avg >= 3) return "You show balanced strengths — explore multiple paths.";
    return "Consider structured roles first; build confidence with small wins.";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeader title="Strengths & Weaknesses" subtitle="Quick self-rating (1–5)."/>
      <ol className="space-y-4">
        {QUESTIONS.map((q,i)=>(
          <li key={i} className="border rounded-xl p-4">
            <div className="mb-2 font-medium">{q}</div>
            <div className="flex items-center gap-2">
              {[1,2,3,4,5].map(v=>(
                <button key={v}
                  onClick={()=>setAnswers(a=>a.map((x,idx)=> idx===i? v : x))}
                  className={"px-3 py-1 rounded border " + (answers[i]===v?"bg-blue-600 text-white":"bg-white")}>
                  {v}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex gap-3">
        <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
        {saved && <span className="text-green-600 self-center">Saved!</span>}
      </div>
      <div className="mt-4 text-sm text-gray-700">
        <b>Quick advice: </b>{scoreAdvice()}
      </div>
    </div>
  )
}
