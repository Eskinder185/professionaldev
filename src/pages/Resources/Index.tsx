import { Link } from "react-router-dom";

export default function Resources(){
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6 fade-in-up">
      <h1 className="text-2xl font-bold gradient-text">Resources</h1>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>
          <Link className="link-accent" to="/resources/roadmaps">Certifications & Learning</Link>
        </li>
        <li>
          <Link className="link-accent" to="/resources/trackers">Skill & Job Trackers</Link>
        </li>
        <li>
          <Link className="link-accent" to="/resources/productivity">Time & Productivity</Link>
        </li>
      </ul>
    </div>
  )
}
