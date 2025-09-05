import { Link, NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
    isActive
      ? "text-blue-600 border-b-2 border-blue-600"
      : "text-gray-600 hover:text-blue-600",
  ].join(" ");

export default function NavBar() {
  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b sticky top-0 z-50 shadow-sm">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl text-blue-600">
          PD Co‑Pilot
        </Link>
        <div className="flex flex-wrap gap-1 md:gap-2">
          <NavLink to="/" className={linkClass} end>
            Home
          </NavLink>
          <NavLink to="/about" className={linkClass}>
            About
          </NavLink>
          <NavLink to="/self-assessment" className={linkClass}>
            Self‑Assessment
          </NavLink>
          <NavLink to="/career-tools" className={linkClass}>
            Career Tools
          </NavLink>
          <NavLink to="/resources" className={linkClass}>
            Resources
          </NavLink>
          <NavLink to="/community" className={linkClass}>
            Community
          </NavLink>
          <NavLink to="/motivation" className={linkClass}>
            Motivation
          </NavLink>
          <NavLink to="/contact" className={linkClass}>
            Contact
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
