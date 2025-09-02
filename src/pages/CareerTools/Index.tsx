import { Link } from "react-router-dom";

export default function CareerTools(){
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold">Career Tools</h1>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li><Link className="text-blue-700 underline" to="/career-tools/resume-linkedin">Resume & LinkedIn</Link></li>
        <li><Link className="text-blue-700 underline" to="/career-tools/star">STAR method practice tool</Link></li>
        <li><Link className="text-blue-700 underline" to="/career-tools/elevator">Elevator pitch generator</Link></li>
        <li><Link className="text-blue-700 underline" to="/career-tools/portfolio">Portfolio & GitHub</Link></li>
      </ul>
    </div>
  )
}
