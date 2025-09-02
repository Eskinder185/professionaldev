import { useEffect, useState } from "react";
import SectionHeader from "../../components/SectionHeader";

export default function Journal(){
  const [text, setText] = useState("");

  useEffect(()=>{
    const saved = localStorage.getItem("pd_journal");
    if (saved) setText(saved);
  },[]);

  function save(){
    localStorage.setItem("pd_journal", text);
  }
  function exportTxt(){
    const blob = new Blob([text], {type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "journal.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeader title="Reflection Journal" subtitle="Write freely; save locally; export anytime."/>
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={12}
        className="w-full border rounded-xl p-3" placeholder="What did I learn? What felt hard? What will I try next?"/>
      <div className="mt-4 flex gap-3">
        <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
        <button onClick={exportTxt} className="border px-4 py-2 rounded">Export TXT</button>
      </div>
    </div>
  )
}
