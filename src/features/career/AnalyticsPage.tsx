import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { getLocal } from "../../hooks/useLocal";
import { lessons } from "../learning/AcademyPage";

export default function AnalyticsPage() {
  const applications = getLocal<{ status?: string }[]>("appTracker:items", []);
  const skills = getLocal<unknown[]>("pd:resources:skills:list", []);
  const learning = getLocal<Record<string, { completed?: boolean }>>("pd:careeros:learning", {});
  const completed = lessons.filter((lesson) => learning[lesson.id]?.completed).length;
  const stages = ["Saved", "Preparing", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"];
  const counts = stages.map((stage) => ({ stage, count: applications.filter((item) => (item.status === "Phone Screen" ? "Screening" : item.status) === stage).length }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  return <div className="career-feature"><div className="career-feature-header"><div><span className="career-overline">YOUR PROGRESS</span><h1>Career analytics</h1><p>A snapshot of records saved in this browser.</p></div></div><div className="career-application-summary"><span><strong>{applications.length}</strong> Applications tracked</span><span><strong>{skills.length}</strong> Skills logged</span><span><strong>{completed}</strong> Lessons completed</span></div><section className="career-panel career-analytics"><h2><BarChart3 size={20} /> Application stages</h2>{applications.length ? counts.map(({ stage, count }) => <div className="career-analytics-row" key={stage}><span>{stage}</span><div><span style={{ width: `${(count / max) * 100}%` }} /></div><strong>{count}</strong></div>) : <div className="career-empty"><h3>No application data yet</h3><p>Add a real application to see your pipeline here.</p><Link to="/applications" className="career-text-link">Open applications</Link></div>}<p className="career-muted">Stage counts are current records, not conversion rates. Response and interview rates need complete event dates and are not estimated.</p></section></div>;
}
