import { useState } from "react";
import SectionHeader from "../../components/SectionHeader";

type AppRow = {company:string; role:string; status:string; notes:string};

export default function Trackers(){
  const [rows, setRows] = useState<AppRow[]>([]);
  const [draft, setDraft] = useState<AppRow>({company:"",role:"",status:"Applied",notes:""});

  function add(){
    setRows(r=>[...r, draft]);
    setDraft({company:"",role:"",status:"Applied",notes:""});
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <SectionHeader title="Trackers" subtitle="Job applications & weekly exit tickets"/>
      <div className="border rounded-xl p-4">
        <h3 className="font-semibold mb-2">Job Application Tracker</h3>
        <div className="grid md:grid-cols-4 gap-2 mb-2">
          <input className="border p-2 rounded" placeholder="Company" value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})}/>
          <input className="border p-2 rounded" placeholder="Role" value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}/>
          <select className="border p-2 rounded" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>
            <option>Applied</option><option>Phone Screen</option><option>Interview</option><option>Offer</option><option>Rejected</option>
          </select>
          <input className="border p-2 rounded" placeholder="Notes" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/>
        </div>
        <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
        <table className="w-full mt-4 text-sm">
          <thead><tr className="text-left"><th>Company</th><th>Role</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>
            {rows.map((r,i)=>(<tr key={i}><td>{r.company}</td><td>{r.role}</td><td>{r.status}</td><td>{r.notes}</td></tr>))}
          </tbody>
        </table>
      </div>
      <div className="border rounded-xl p-4">
        <h3 className="font-semibold mb-2">Weekly Exit Ticket (3 Qs)</h3>
        <ol className="list-decimal pl-6 space-y-2">
          <li>What’s one thing you learned?</li>
          <li>What was interesting?</li>
          <li>What questions do you still have?</li>
        </ol>
      </div>
    </div>
  )
}
