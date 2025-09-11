import { Routes, Route } from "react-router-dom";

// PAGES
import StrengthsQuiz from "./pages/SelfAssessment/StrengthsQuiz";
import ValuesWorksheet from "./pages/SelfAssessment/ValuesWorksheet";
import InterestsQuiz from "./pages/SelfAssessment/InterestsQuiz";
import Journal from "./pages/SelfAssessment/Journal";
import StrengthsTest from "./pages/SelfAssessment/StrengthsTest";
import CoreValues from "./pages/SelfAssessment/CoreValues";
import CareerInterests from "./pages/SelfAssessment/CareerInterests";
import JournalStudio from "./pages/SelfAssessment/JournalStudio";

// Career tools pages
import ResumeLinkedIn from "./pages/CareerTools/ResumeLinkedIn";
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

// Resource pages
import Roadmaps from "./pages/Resources/Roadmaps";
import CertsLearning from "./pages/Resources/CertsLearning";
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
import Community from "./pages/Community";
import Motivation from "./pages/Motivation";
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
          <Route path="/self-assessment/journal" element={<Journal />} />
          <Route path="/self/strengths" element={<StrengthsTest />} />
          <Route path="/self/values" element={<CoreValues />} />
          <Route path="/self/interests" element={<CareerInterests />} />
          <Route path="/self/journal" element={<JournalStudio />} />

          {/* Career Tools routes */}
          <Route path="/career-tools" element={<CareerTools />} />
          <Route path="/career-tools/resume-linkedin" element={<ResumeLinkedIn />} />
          <Route path="/career-tools/resume-grader" element={<ResumeGrader />} />
          <Route path="/career-tools/star" element={<InterviewSTAR />} />
          <Route path="/career-tools/stories" element={<StoryBuilder />} />
          <Route path="/career-tools/elevator" element={<ElevatorPitch />} />
          <Route path="/career-tools/elevator-studio" element={<ElevatorStudio />} />
          <Route path="/career-tools/portfolio" element={<PortfolioGitHub />} />
          <Route path="/career-tools/star-builder" element={<StarBuilder />} />
          <Route path="/career-tools/interview-sim" element={<InterviewSim />} />
          <Route path="/career/star-tool" element={<StarTool />} />
          <Route path="/career/portfolio-audit" element={<PortfolioAudit />} />

          {/* Resource routes */}
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/roadmaps" element={<Roadmaps />} />
          <Route path="/resources/certs" element={<CertsLearning />} />
          <Route path="/resources/trackers" element={<Trackers />} />
          <Route path="/resources/productivity" element={<Productivity />} />
          <Route path="/Resources/JobSites" element={<JobSites />} />
          <Route path="/resources/app-tracker" element={<AppTracker />} />

          <Route path="/community" element={<Community />} />
          <Route path="/motivation" element={<Motivation />} />
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
