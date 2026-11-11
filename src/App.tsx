import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import NavBar from "./components/NavBar";
import SiteBackground from "./components/shell/SiteBackground";
import SiteFooter from "./components/shell/SiteFooter";
import AuthCallback from "./auth/AuthCallback";
import WorkspaceShell from "./components/layout/WorkspaceShell";
import { AIConnectionProvider } from "./features/ai/AIConnectionProvider";

const About = lazy(() => import("./pages/About"));
const AppTracker = lazy(() => import("./pages/AppTracker"));
const Contact = lazy(() => import("./pages/Contact"));
const InterviewSim = lazy(() => import("./pages/InterviewSim"));
const Settings = lazy(() => import("./pages/Settings"));
const StarBuilder = lazy(() => import("./pages/StarBuilder"));
const TechCareerHub = lazy(() => import("./pages/TechCareerHub"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const JobsPage = lazy(() => import("./features/jobs/JobsPage"));
const MatchesPage = lazy(() => import("./features/jobs/MatchesPage"));
const DocumentsPage = lazy(() => import("./features/documents/DocumentsPage"));
const CoverLetterEditor = lazy(() => import("./features/documents/CoverLetterEditor"));
const AcademyPage = lazy(() => import("./features/learning/AcademyPage"));
const ApplicationsPage = lazy(() => import("./features/applications/ApplicationsPage"));
const AutoApplyPage = lazy(() => import("./features/autoapply/AutoApplyPage"));
const SyntheticApplicationPage = lazy(() => import("./features/autoapply/SyntheticApplicationPage"));
const ResumeStudioPage = lazy(() => import("./features/resume/ResumeStudioPage"));
const AnalyticsPage = lazy(() => import("./features/career/AnalyticsPage"));
const CoachPage = lazy(() => import("./features/ai/CoachPage"));
const InterviewStudioPage = lazy(() => import("./features/interviews/InterviewStudioPage"));

const BehavioralBank = lazy(() => import("./pages/CareerTools/BehavioralBank"));
const CareerTools = lazy(() => import("./pages/CareerTools/Index"));
const ElevatorPitch = lazy(() => import("./pages/CareerTools/ElevatorPitch"));
const ElevatorStudio = lazy(() => import("./pages/CareerTools/ElevatorStudio"));
const GitHubGuide = lazy(() => import("./pages/CareerTools/GitHubGuide"));
const InterviewSTAR = lazy(() => import("./pages/CareerTools/InterviewSTAR"));
const LinkedInGuide = lazy(() => import("./pages/CareerTools/LinkedInGuide"));
const PortfolioAudit = lazy(() => import("./pages/CareerTools/PortfolioAudit"));
const PortfolioGitHub = lazy(() => import("./pages/CareerTools/PortfolioGitHub"));
const ResumeGrader = lazy(() => import("./pages/CareerTools/ResumeGrader"));
const StarTool = lazy(() => import("./pages/CareerTools/StarTool"));
const StoryBuilder = lazy(() => import("./pages/CareerTools/StoryBuilder"));

const Certs = lazy(() => import("./pages/Resources/Certs"));
const JobSites = lazy(() => import("./pages/Resources/JobSites"));
const Productivity = lazy(() => import("./pages/Resources/Productivity"));
const Resources = lazy(() => import("./pages/Resources/Index"));
const Roadmaps = lazy(() => import("./pages/Resources/Roadmaps"));
const Trackers = lazy(() => import("./pages/Resources/Trackers"));

const CareerInterests = lazy(() => import("./pages/SelfAssessment/CareerInterests"));
const CoreValues = lazy(() => import("./pages/SelfAssessment/CoreValues"));
const InterestsQuiz = lazy(() => import("./pages/SelfAssessment/InterestsQuiz"));
const SelfAssessment = lazy(() => import("./pages/SelfAssessment/Index"));
const StrengthsQuiz = lazy(() => import("./pages/SelfAssessment/StrengthsQuiz"));
const StrengthsTest = lazy(() => import("./pages/SelfAssessment/StrengthsTest"));
const ValuesWorksheet = lazy(() => import("./pages/SelfAssessment/ValuesWorksheet"));

export default function App() {
  return (
    <AIConnectionProvider>
    <Routes>
      <Route path="/" element={<div className="relative flex min-h-screen flex-col"><SiteBackground /><NavBar /><main className="mx-auto w-full max-w-content flex-grow px-4 py-8 sm:px-6 sm:py-10 md:py-12"><Home /></main><SiteFooter /></div>} />
      <Route path="/*" element={<WorkspaceShell><main id="workspace-main" className="career-main">
        <Suspense
          fallback={(
            <div className="py-16 text-center text-sm text-ink-muted" role="status">
              Loading page…
            </div>
          )}
        >
          <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/academy" element={<AcademyPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/tracker" element={<ApplicationsPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/letters/:id" element={<CoverLetterEditor />} />
          <Route path="/autoapply" element={<AutoApplyPage />} />
          <Route path="/autoapply/sandbox" element={<SyntheticApplicationPage />} />
          <Route path="/resume" element={<ResumeStudioPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/coach" element={<CoachPage />} />
          <Route path="/interviews" element={<InterviewStudioPage />} />
          <Route path="/about" element={<About />} />

          {/* High-impact tools */}
          <Route path="/settings" element={<Settings />} />

          {/* Self-Assessment routes */}
          <Route path="/self-assessment" element={<SelfAssessment />} />
          <Route path="/self-assessment/strengths" element={<StrengthsQuiz />} />
          <Route path="/self-assessment/values" element={<ValuesWorksheet />} />
          <Route path="/self-assessment/interests" element={<InterestsQuiz />} />
          <Route path="/self/strengths" element={<StrengthsTest />} />
          <Route path="/self/values" element={<CoreValues />} />
          <Route path="/self/interests" element={<CareerInterests />} />

          {/* Career Tools routes */}
          <Route path="/career-tools" element={<CareerTools />} />
          <Route path="/career-tools/resume-grader" element={<ResumeGrader />} />
          <Route path="/career-tools/star" element={<InterviewSTAR />} />
          <Route path="/career-tools/stories" element={<StoryBuilder />} />
          <Route path="/career-tools/behavioral" element={<BehavioralBank />} />
          <Route path="/career-tools/elevator" element={<ElevatorPitch />} />
          <Route path="/career-tools/elevator-studio" element={<ElevatorStudio />} />
          <Route path="/career-tools/portfolio" element={<PortfolioGitHub />} />
          <Route path="/career-tools/star-builder" element={<StarBuilder />} />
          <Route path="/career-tools/interview-sim" element={<InterviewSim />} />
          <Route path="/career/star-tool" element={<StarTool />} />
          <Route path="/career/portfolio-audit" element={<PortfolioAudit />} />
          <Route path="/career-tools/linkedin" element={<LinkedInGuide />} />
          <Route path="/career-tools/github" element={<GitHubGuide />} />

          {/* Resource routes */}
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/roadmaps" element={<Roadmaps />} />
          <Route path="/resources/certs" element={<Certs />} />
          <Route path="/Resources/Certs" element={<Certs />} />
          <Route path="/resources/trackers" element={<Trackers />} />
          <Route path="/resources/productivity" element={<Productivity />} />
          <Route path="/Resources/JobSites" element={<JobSites />} />
          <Route path="/resources/job-sites" element={<JobSites />} />
          <Route path="/resources/app-tracker" element={<AppTracker />} />

          <Route path="/contact" element={<Contact />} />
          <Route path="/tech-career-hub" element={<TechCareerHub />} />
          <Route path="*" element={<div className="career-panel"><h1>Page not found</h1><p>This page is unavailable. Use the workspace navigation to continue.</p></div>} />
          </Routes>
        </Suspense>
      </main></WorkspaceShell>} />
    </Routes>
    </AIConnectionProvider>
  );
}
