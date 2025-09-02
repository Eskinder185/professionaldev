import SectionHeader from "../../components/SectionHeader";

export default function Roadmaps(){
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <SectionHeader title="Certification Roadmaps" subtitle="AWS SAA | Security+ | AI Practitioner"/>
      <details className="border rounded-xl p-4">
        <summary className="font-semibold">AWS Solutions Architect – Associate</summary>
        <ul className="list-disc pl-6 mt-2">
          <li>Core: IAM, VPC, EC2, S3, RDS, Route53</li>
          <li>Hands-on: VPC + EC2 lab, S3 static hosting</li>
          <li>Practice: TD exams, whitepapers</li>
        </ul>
      </details>
      <details className="border rounded-xl p-4">
        <summary className="font-semibold">CompTIA Security+</summary>
        <ul className="list-disc pl-6 mt-2">
          <li>Domains: Threats, Architecture, Ops, Governance</li>
          <li>Labs: SIEM basics, Wireshark captures</li>
        </ul>
      </details>
    </div>
  )
}
