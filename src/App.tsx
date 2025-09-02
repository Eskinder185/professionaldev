import { Routes, Route, Link } from "react-router-dom";

// PAGES
import StrengthsQuiz from "./pages/SelfAssessment/StrengthsQuiz";
import ValuesWorksheet from "./pages/SelfAssessment/ValuesWorksheet";
import InterestsQuiz from "./pages/SelfAssessment/InterestsQuiz";
import Journal from "./pages/SelfAssessment/Journal";

import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import SelfAssessment from "./pages/SelfAssessment/Index";
import CareerTools from "./pages/CareerTools/Index";
import Resources from "./pages/Resources/Index";
import Community from "./pages/Community";
import Motivation from "./pages/Motivation";

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-blue-600 text-white p-4 flex justify-between">
        <div className="font-bold">PD Site</div>
        <div className="space-x-4">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/self-assessment">Self-Assessment</Link>
          <Link to="/career-tools">Career Tools</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/community">Community</Link>
          <Link to="/motivation">Motivation</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </nav>

      <main className="flex-grow p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />

          {/* NEW SECTION ROUTES */}
          <Route path="/self-assessment" element={<SelfAssessment />} />
          <Route path="/career-tools" element={<CareerTools />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/community" element={<Community />} />
          <Route path="/motivation" element={<Motivation />} />

          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>

      <footer className="bg-gray-200 p-4 text-center">© 2025 PD Site</footer>
    </div>
  );
}

export default App;
