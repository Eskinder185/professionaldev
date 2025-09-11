import React from "react";

type Site = { name: string; desc: string; url: string };

const SITES: Site[] = [
  {
    name: "JobLeads",
    desc: "Premium job aggregator with coaching & headhunter access.",
    url: "https://www.jobleads.com/",
  },
  {
    name: "Wellfound (formerly AngelList Talent)",
    desc: "Startup & remote jobs; salary/equity shown.",
    url: "https://wellfound.com/",
  },
  {
    name: "ZipRecruiter",
    desc: "General job board with 1-click apply.",
    url: "https://www.ziprecruiter.com/",
  },
  {
    name: "TAG Career Center (jobs.tagonline.org)",
    desc: "Georgia Technology Association board & career guides.",
    url: "https://jobs.tagonline.org/",
  },
  {
    name: "Remote.co — Remote Jobs",
    desc: "Curated remote jobs plus resources.",
    url: "https://remote.co/remote-jobs",
  },
  {
    name: "FlexJobs",
    desc: "Hand-screened remote & flexible jobs.",
    url: "https://www.flexjobs.com/",
  },
  {
    name: "Remotesome",
    desc: "Vetted remote developers with assessment-based matching.",
    url: "https://www.remotesome.com/",
  },
  {
    name: "Dice",
    desc: "Tech-centric job board with recruiters & salary tools.",
    url: "https://www.dice.com/",
  },
  {
    name: "LinkedIn Jobs",
    desc: "Large professional network; referrals & Easy Apply with powerful filters.",
    url: "https://www.linkedin.com/jobs/",
  },
];

export default function JobSites() {
  return (
    <div className="space-y-6">
      <header className="surface-muted p-6">
        <h1 className="brand-heading text-2xl font-semibold">Job Sites</h1>
        <p>
          Explore quality job boards. Tip: save searches + set alerts; tailor your résumé to the posting.
        </p>
      </header>

      <div className="surface p-2 md:p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--stroke)]">
                <th className="py-3 pr-4">Webpage name</th>
                <th className="py-3 pr-4">Short description</th>
                <th className="py-3">Website link</th>
              </tr>
            </thead>
            <tbody>
              {SITES.map((s) => (
                <tr key={s.name} className="border-b border-[var(--stroke)]/50">
                  <td className="py-3 pr-4 font-medium">{s.name}</td>
                  <td className="py-3 pr-4">{s.desc}</td>
                  <td className="py-3">
                    <a href={s.url} target="_blank" rel="noreferrer" className="btn btn-primary">
                      Visit →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

