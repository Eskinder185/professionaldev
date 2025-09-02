import { useEffect, useState } from "react";

const quotes = [
  "Growth happens just outside your comfort zone.",
  "Done is better than perfect — iterate.",
  "Small daily progress beats occasional bursts."
];

export default function QuoteWidget(){
  const [i,setI] = useState(0);
  useEffect(()=>{
    const id = setInterval(()=> setI(prev => (prev+1)%quotes.length), 4000);
    return () => clearInterval(id);
  },[]);
  return (
    <div className="italic text-gray-700">{quotes[i]}</div>
  )
}
