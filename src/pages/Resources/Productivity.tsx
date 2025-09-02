import { useEffect, useRef, useState } from "react";
import SectionHeader from "../../components/SectionHeader";

function useTimer(startSeconds:number){
  const [secs, setSecs] = useState(startSeconds);
  const [running, setRunning] = useState(false);
  const ref = useRef<number | null>(null);

  useEffect(()=>{
    if (running){
      ref.current = window.setInterval(()=> setSecs(s=> Math.max(0,s-1)), 1000);
    }
    return ()=> { if (ref.current) window.clearInterval(ref.current) }
  }, [running]);

  function reset(){ setSecs(startSeconds); setRunning(false); }
  return { secs, running, setRunning, reset };
}

export default function Productivity(){
  const {secs, running, setRunning, reset} = useTimer(25*60);
  const mm = String(Math.floor(secs/60)).padStart(2,"0");
  const ss = String(secs%60).padStart(2,"0");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <SectionHeader title="Productivity" subtitle="Pomodoro 25:00 focus timer"/>
      <div className="text-5xl font-mono text-center">{mm}:{ss}</div>
      <div className="flex gap-3 justify-center">
        {!running ? <button onClick={()=>setRunning(true)} className="bg-blue-600 text-white px-4 py-2 rounded">Start</button>
                  : <button onClick={()=>setRunning(false)} className="border px-4 py-2 rounded">Pause</button>}
        <button onClick={reset} className="border px-4 py-2 rounded">Reset</button>
      </div>
    </div>
  )
}
