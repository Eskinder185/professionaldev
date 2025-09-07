import { Routes, Route } from "react-router-dom";

// PAGES
import StrengthsQuiz from "./pages/SelfAssessment/StrengthsQuiz";
import ValuesWorksheet from "./pages/SelfAssessment/ValuesWorksheet";
import InterestsQuiz from "./pages/SelfAssessment/InterestsQuiz";
import Journal from "./pages/SelfAssessment/Journal";

// Career tools pages
import ResumeLinkedIn from "./pages/CareerTools/ResumeLinkedIn";
import InterviewSTAR from "./pages/CareerTools/InterviewSTAR";
import ElevatorPitch from "./pages/CareerTools/ElevatorPitch";
import PortfolioGitHub from "./pages/CareerTools/PortfolioGitHub";

// Resource pages
import Roadmaps from "./pages/Resources/Roadmaps";
import Trackers from "./pages/Resources/Trackers";
import Productivity from "./pages/Resources/Productivity";

import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import SelfAssessment from "./pages/SelfAssessment/Index";
import CareerTools from "./pages/CareerTools/Index";
import Resources from "./pages/Resources/Index";
import Community from "./pages/Community";
import Motivation from "./pages/Motivation";

import NavBar from "./components/NavBar";
import AnimatedBackground from "./components/AnimatedBackground";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />    {/* animated gradient */}
      <NavBar />

      <main className="flex-grow p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />

          {/* Self-Assessment routes */}
          <Route path="/self-assessment" element={<SelfAssessment />} />
          <Route path="/self-assessment/strengths" element={<StrengthsQuiz />} />
          <Route path="/self-assessment/values" element={<ValuesWorksheet />} />
          <Route path="/self-assessment/interests" element={<InterestsQuiz />} />
          <Route path="/self-assessment/journal" element={<Journal />} />

          {/* Career Tools routes */}
          <Route path="/career-tools" element={<CareerTools />} />
          <Route path="/career-tools/resume-linkedin" element={<ResumeLinkedIn />} />
          <Route path="/career-tools/star" element={<InterviewSTAR />} />
          <Route path="/career-tools/elevator" element={<ElevatorPitch />} />
          <Route path="/career-tools/portfolio" element={<PortfolioGitHub />} />

          {/* Resource routes */}
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/roadmaps" element={<Roadmaps />} />
          <Route path="/resources/trackers" element={<Trackers />} />
          <Route path="/resources/productivity" element={<Productivity />} />

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
