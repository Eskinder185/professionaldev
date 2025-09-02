import { Link } from "react-router-dom";
import QuoteWidget from "../components/QuoteWidget";

export default function Home(){
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="bg-blue-50 border border-blue-100 rounded-2xl p-8 mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Professional Development Co‑Pilot</h1>
        <p className="text-gray-700 mb-4">Guiding you through self‑assessment, planning, action, and reflection so you can land roles with confidence.</p>
        <div className="text-sm"><QuoteWidget /></div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Self‑Assessment" to="/self-assessment" desc="Quizzes, reflection journal, imposter check‑ins."/>
        <Card title="Career Tools" to="/career-tools" desc="Resume & LinkedIn, Interview prep, Portfolio tips."/>
        <Card title="Resources" to="/resources" desc="Cert roadmaps, trackers, productivity widgets."/>
        <Card title="Community" to="/community" desc="Success stories, mentor spotlights, Q&A."/>
      </section>
    </div>
  )
}

function Card({title, desc, to}:{title:string; desc:string; to:string}){
  return (
    <Link to={to} className="block border rounded-xl p-5 hover:shadow-md bg-white">
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
    </Link>
  )
}
