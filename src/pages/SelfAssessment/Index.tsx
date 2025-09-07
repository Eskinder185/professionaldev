import { Link } from "react-router-dom";

export default function SelfAssessment(){
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6 fade-in-up">
      <h1 className="text-2xl font-bold gradient-text">Self‑Assessment</h1>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>
          <Link className="link-accent" to="/self-assessment/strengths">Strengths & weaknesses test</Link>
        </li>
        <li>
          <Link className="link-accent" to="/self-assessment/values">Core values worksheet</Link>
        </li>
        <li>
          <Link className="link-accent" to="/self-assessment/interests">Career interest quiz</Link>
        </li>
        <li>
          <Link className="link-accent" to="/self-assessment/journal">Journaling space (save/export)</Link>
        </li>
      </ul>
    </div>
  )
}
