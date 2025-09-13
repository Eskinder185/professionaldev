import { Routes, Route } from "react-router-dom";
import LinkedInGuide from "./pages/CareerTools/LinkedInGuide";
import GitHubGuide from "./pages/CareerTools/GitHubGuide";
import Certs from "./pages/Resources/Certs";

// PAGES
import StrengthsQuiz from "./pages/SelfAssessment/StrengthsQuiz";
import ValuesWorksheet from "./pages/SelfAssessment/ValuesWorksheet";
import InterestsQuiz from "./pages/SelfAssessment/InterestsQuiz";
import StrengthsTest from "./pages/SelfAssessment/StrengthsTest";
import CoreValues from "./pages/SelfAssessment/CoreValues";
import CareerInterests from "./pages/SelfAssessment/CareerInterests";

// Career tools pages
import InterviewSTAR from "./pages/CareerTools/InterviewSTAR";
import ElevatorPitch from "./pages/CareerTools/ElevatorPitch";
import PortfolioGitHub from "./pages/CareerTools/PortfolioGitHub";
import StarBuilder from "./pages/StarBuilder";
import InterviewSim from "./pages/InterviewSim";
import StarTool from "./pages/CareerTools/StarTool";
import PortfolioAudit from "./pages/CareerTools/PortfolioAudit";
import ResumeGrader from "./pages/CareerTools/ResumeGrader";
import StoryBuilder from "./pages/CareerTools/StoryBuilder";
import ElevatorStudio from "./pages/CareerTools/ElevatorStudio";
import BehavioralBank from "./pages/CareerTools/BehavioralBank";

// Resource pages
import Roadmaps from "./pages/Resources/Roadmaps";
import Trackers from "./pages/Resources/Trackers";
import Productivity from "./pages/Resources/Productivity";
import Settings from "./pages/Settings";
import AppTracker from "./pages/AppTracker";
import JobSites from "./pages/Resources/JobSites";

import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import SelfAssessment from "./pages/SelfAssessment/Index";
import CareerTools from "./pages/CareerTools/Index";
import Resources from "./pages/Resources/Index";
// (no duplicate imports)

import NavBar from "./components/NavBar";
import BackgroundConstellations from "./components/backgrounds/BackgroundConstellations";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <BackgroundConstellations />
      <NavBar />

      <main className="flex-grow p-6">
        <Routes>
          <Route path="/" element={<Home />} />
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
          <Route path="/resources/app-tracker" element={<AppTracker />} />

          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>

      {/* Updated footer text */}
      <footer className="bg-white/50 backdrop-blur p-4 text-center text-gray-600">
        © 2025 Roadmap to Role
      </footer>
    </div>
  );
}
