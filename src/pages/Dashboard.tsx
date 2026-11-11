import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, BriefcaseBusiness, CheckCircle2, Compass, FileText, Search, Target } from "lucide-react";
import { getLocal, setLocal } from "../hooks/useLocal";
import { lessons } from "../features/learning/AcademyPage";
import { loadJobStore } from "../features/jobs/store";
import FocusTasks from "../features/dashboard/FocusTasks";
import HomeAIPanel from "../features/ai/HomeAIPanel";

type Application = { status?: string; company?: string; role?: string };
type Skill = { skill?: string };

const applicationStages = ["Saved", "Applied", "Screening", "Interview", "Offer"];

export default function Dashboard() {
  const [goal, setGoal] = useState(() => getLocal("pd:careeros:goal", ""));
  const [editingGoal, setEditingGoal] = useState(false);
  const applications = getLocal<Application[]>("appTracker:items", []);
  const skills = getLocal<Skill[]>("pd:resources:skills:list", []);
  const savedJobs = loadJobStore().saved;
  const completed = getLocal<Record<string, { completed?: boolean }>>("pd:careeros:learning", {});
  const doneCount = lessons.filter((lesson) => completed[lesson.id]?.completed).length;
  const nextStep = lessons.find((lesson) => !completed[lesson.id]?.completed);
  const path = lessons.length > 0;
  const count = (status: string) => applications.filter((item) => {
    if (status === "Screening") return item.status === "Phone Screen" || item.status === "Screening";
    return item.status === status;
  }).length;
  const appliedCount = applications.filter((item) => item.status && item.status !== "Saved" && item.status !== "Preparing").length;

  return <div className="career-dashboard">
    <div className="career-page-eyebrow"><Compass size={15} /> YOUR CAREER COMMAND CENTER</div>
    <section className="career-hero"><div className="career-hero-content"><span className="career-overline">WELCOME TO CAREEROS</span><h1>Your career, moving forward.</h1><p>Discover opportunities. Build skills. Create your future.</p><div className="career-hero-goal"><Target size={18} /><span>Target career</span>{editingGoal ? <input aria-label="Target career" autoFocus value={goal} maxLength={80} placeholder="e.g. Software Engineer" onChange={(event) => setGoal(event.target.value)} onBlur={() => { setLocal("pd:careeros:goal", goal.trim()); setEditingGoal(false); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /> : <button type="button" onClick={() => setEditingGoal(true)}>{goal || "Choose a career goal"}</button>}</div></div><div className="career-hero-art" aria-hidden="true"><div className="career-art-orbit"><span className="career-art-node career-art-node-one"><Search size={18} /></span><span className="career-art-node career-art-node-two"><BookOpen size={18} /></span><span className="career-art-node career-art-node-three"><BriefcaseBusiness size={18} /></span><div className="career-art-center"><Compass size={30} /><span>YOUR PATH</span></div></div></div></section>
    <HomeAIPanel />
    <div className="career-section-heading"><div><span className="career-overline">AT A GLANCE</span><h2>Your workspace</h2></div><span>Based on records stored in this browser</span></div>
    <div className="career-metrics">
      <Metric label="Saved jobs" value={savedJobs.length} detail="Jobs you saved" icon={BriefcaseBusiness} to="/jobs" />
      <Metric label="Applications submitted" value={appliedCount} detail="Includes later pipeline stages" icon={CheckCircle2} to="/applications" />
      <Metric label="Interview stage" value={count("Interview")} detail="Current application statuses" icon={BriefcaseBusiness} to="/applications" />
      <Metric label="Lessons completed" value={doneCount} detail={path ? `Of ${lessons.length} Academy lessons` : "Explore lessons"} icon={BookOpen} to="/academy" />
      <Metric label="Skills logged" value={skills.length} detail="Self-reported practice records" icon={Target} to="/resources/trackers" />
    </div>
    <div className="career-dashboard-grid"><section className="career-panel career-focus"><div className="career-panel-heading"><div><span className="career-overline">NEXT STEPS</span><h2>Today's focus</h2></div><span className="career-panel-icon"><Target size={19} /></span></div><p className="career-panel-intro">A clear place to start, based on what you have saved so far.</p><FocusTasks /><div className="career-action-list"><Action to={goal ? "/resources/roadmaps" : "/self-assessment"} icon={Compass} title={goal ? `Explore your ${goal} roadmap` : "Choose a direction"} detail={goal ? "Review career roadmap options" : "Explore your strengths and interests"} /><Action to={nextStep ? "/academy" : "/resume"} icon={nextStep ? BookOpen : FileText} title={nextStep ? nextStep.title : "Review your résumé"} detail={nextStep ? "Next Academy lesson" : "Edit or review your résumé"} /><Action to="/applications" icon={BriefcaseBusiness} title={applications.length ? "Review your applications" : "Track your first application"} detail={applications.length ? `${applications.length} record${applications.length === 1 ? "" : "s"} saved` : "Keep your search organized"} /></div></section>
    <section className="career-panel career-jobs"><div className="career-panel-heading"><div><span className="career-overline">OPPORTUNITIES</span><h2>Recommended jobs</h2></div><span className="career-panel-icon"><Search size={19} /></span></div><div className="career-empty"><div className="career-empty-icon"><BriefcaseBusiness size={25} /></div><h3>No live jobs connected yet</h3><p>Job recommendations will appear when an authorized job source is configured. You can browse trusted job sites now.</p><Link to="/jobs" className="career-text-link">Explore job resources <ArrowRight size={16} /></Link></div></section></div>
    <div className="career-dashboard-grid career-dashboard-bottom"><section className="career-panel"><div className="career-panel-heading"><div><span className="career-overline">KEEP BUILDING</span><h2>Continue learning</h2></div><BookOpen size={20} /></div>{path ? <><p className="career-learning-title">{"Academy lessons"}</p><p className="career-muted">{doneCount} of {lessons.length} steps completed</p><div className="career-progress" role="progressbar" aria-label="Learning path progress" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={lessons.length}><span style={{ width: `${Math.round(doneCount / lessons.length * 100)}%` }} /></div><Link to="/academy" className="career-text-link">{nextStep ? `Continue: ${nextStep.title}` : "Review completed path"} <ArrowRight size={16} /></Link></> : <div className="career-empty compact"><p>Explore a lesson to start tracking progress.</p><Link to="/academy" className="career-text-link">Explore lessons <ArrowRight size={16} /></Link></div>}</section><section className="career-panel" id="pipeline"><div className="career-panel-heading"><div><span className="career-overline">YOUR SEARCH</span><h2>Application pipeline</h2></div><BriefcaseBusiness size={20} /></div><div className="career-pipeline">{applicationStages.map((stage) => <Link to="/applications" key={stage}><strong>{count(stage)}</strong><span>{stage}</span></Link>)}</div><p className="career-muted">Counts reflect your application tracker records only.</p><Link to="/applications" className="career-text-link">Open application tracker <ArrowRight size={16} /></Link></section></div>
  </div>;
}

function Metric({ label, value, detail, icon: Icon, to }: { label: string; value: number; detail: string; icon: typeof Target; to: string }) { return <Link to={to} className="career-metric"><span className="career-metric-icon"><Icon size={19} /></span><strong>{value}</strong><span className="career-metric-label">{label}</span><small>{detail}</small></Link>; }
function Action({ to, icon: Icon, title, detail }: { to: string; icon: typeof Target; title: string; detail: string }) { return <Link to={to} className="career-action"><span><Icon size={18} /></span><div><strong>{title}</strong><small>{detail}</small></div><ArrowRight size={16} /></Link>; }
