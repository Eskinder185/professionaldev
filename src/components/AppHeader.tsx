import React, { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

export default function AppHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll(); window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`sticky top-0 z-50 backdrop-blur ${scrolled ? "bg-white/50 dark:bg-black/25 shadow-[0_1px_0_0_rgba(0,0,0,.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,.08)]" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold tracking-tight">ProfessionalDev</Link>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/" className="hover:opacity-80">Home</NavLink>
          <NavLink to="/SelfAssessment" className="hover:opacity-80">Self-Assessment</NavLink>
          <NavLink to="/CareerTools" className="hover:opacity-80">Career Tools</NavLink>
          <NavLink to="/Resources" className="hover:opacity-80">Resources</NavLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
