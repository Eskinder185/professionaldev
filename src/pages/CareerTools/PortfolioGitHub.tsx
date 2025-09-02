import SectionHeader from "../../components/SectionHeader";

export default function PortfolioGitHub(){
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-4">
      <SectionHeader title="Portfolio & GitHub" subtitle="Make projects easy to scan and hire from."/>
      <ol className="list-decimal pl-6 space-y-2">
        <li>Clear README (What/Why/How/Run/Demo)</li>
        <li>Consistent names + tags (aws, react, security)</li>
        <li>Screenshots or short GIF in README</li>
        <li>Deployed demo links when possible</li>
      </ol>
    </div>
  )
}
