import { useEffect, useState } from "react";
import SectionHeader from "../../components/SectionHeader";

const VALUES = ["Curiosity","Impact","Stability","Autonomy","Collaboration","Creativity","Security","Learning"];

export default function ValuesWorksheet(){
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(()=>{
    const saved = localStorage.getItem("pd_values");
    if (saved) setPicked(JSON.parse(saved));
  },[]);

  function toggle(v:string){
    setPicked(prev=>{
      const next = prev.includes(v) ? prev.filter(x=>x!==v) : [...prev, v];
      localStorage.setItem("pd_values", JSON.stringify(next));
      return next;
    });
  }

  function exportTxt(){
    const blob = new Blob([`My core values:\n${picked.join(", ")}`], {type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "core-values.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeader title="Core Values Worksheet" subtitle="Pick 3–5 values that matter most."/>
      <div className="flex flex-wrap gap-2">
        {VALUES.map(v=> (
          <button key={v} onClick={()=>toggle(v)}
            className={"px-3 py-2 rounded border " + (picked.includes(v) ? "bg-blue-600 text-white" : "bg-white")}>
            {v}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <button onClick={exportTxt} className="bg-blue-600 text-white px-4 py-2 rounded">Export to TXT</button>
      </div>
    </div>
  )
}
