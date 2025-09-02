import SectionHeader from "../../components/SectionHeader";

export default function ResumeLinkedIn(){
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <SectionHeader title="Resume & LinkedIn" subtitle="ATS-friendly tips + quick checklist."/>
      <div className="grid md:grid-cols-2 gap-6">
        <ul className="list-disc pl-6 bg-white border rounded-xl p-4">
          <li>One column, clear headings, no tables</li>
          <li> Bullets start with action verbs; quantify impact</li>
          <li> Include keywords from the job description</li>
          <li> Link to GitHub/Portfolio</li>
        </ul>
        <ul className="list-disc pl-6 bg-white border rounded-xl p-4">
          <li>LinkedIn headline: role + key skills</li>
          <li>Top link: “Check my portfolio”</li>
          <li>Add projects with media links</li>
          <li>Post weekly — learning or projects</li>
        </ul>
      </div>
    </div>
  )
}
