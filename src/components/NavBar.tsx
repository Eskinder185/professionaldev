import { Link, NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
    isActive
      ? "text-primary border-b-2 border-primary"
      : "text-gray-600 hover:text-primary",
  ].join(" ");

export default function NavBar() {
  return (
    <nav className="bg-white/75 dark:bg-black/25 backdrop-blur-md border-b border-gray-200 dark:border-white/10 sticky top-0 z-50 shadow-sm">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl gradient-text">
          Roadmap to Role
          </Link>

        <div className="flex flex-wrap items-center gap-1 md:gap-2">
          <NavLink to="/" className={linkClass} end>
            Home
          </NavLink>
          <NavLink to="/about" className={linkClass}>
            About
          </NavLink>
          <NavLink to="/self-assessment" className={linkClass}>
            Self-Assessment
          </NavLink>
          <NavLink to="/career-tools" className={linkClass}>
            Career Tools
          </NavLink>
          <NavLink to="/resources" className={linkClass}>
            Resources
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            Settings
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
          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
