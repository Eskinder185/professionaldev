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

// Layout components
import NavBar from "./components/NavBar";

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navigation */}
      <NavBar />

      <main className="flex-grow p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />

          {/* NEW SECTION ROUTES */}
          <Route path="/self-assessment" element={<SelfAssessment />} />
          {/* Self‑Assessment sub-pages */}
          <Route path="/self-assessment/strengths" element={<StrengthsQuiz />} />
          <Route path="/self-assessment/values" element={<ValuesWorksheet />} />
          <Route path="/self-assessment/interests" element={<InterestsQuiz />} />
          <Route path="/self-assessment/journal" element={<Journal />} />
          <Route path="/career-tools" element={<CareerTools />} />
          {/* Career Tools sub-pages */}
          <Route path="/career-tools/resume-linkedin" element={<ResumeLinkedIn />} />
          <Route path="/career-tools/star" element={<InterviewSTAR />} />
          <Route path="/career-tools/elevator" element={<ElevatorPitch />} />
          <Route path="/career-tools/portfolio" element={<PortfolioGitHub />} />
          <Route path="/resources" element={<Resources />} />
          {/* Resources sub-pages */}
          <Route path="/resources/roadmaps" element={<Roadmaps />} />
          <Route path="/resources/trackers" element={<Trackers />} />
          <Route path="/resources/productivity" element={<Productivity />} />
          <Route path="/community" element={<Community />} />
          <Route path="/motivation" element={<Motivation />} />

          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>

      <footer className="bg-gray-100 p-4 text-center text-gray-600">
        © 2025 PD Co‑Pilot
      </footer>
    </div>
  );
}

export default App;
