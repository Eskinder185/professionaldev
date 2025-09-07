import { useEffect, useMemo, useState } from "react";
import QuoteWidget from "../components/QuoteWidget";

/**
 * Motivation Hub
 *
 * Provides a daily check‑in streak tracker, simple achievement badges,
 * a quote of the day, and habit toggles. All progress is stored
 * locally in the browser via localStorage so users can come back and
 * continue where they left off. The design uses cards with light
 * backgrounds, rounded corners, and subtle shadows for a clean feel.
 */

// Keys for persisting streak and habit state
const STREAK_KEY = "pd_motivation_streak";
const BEST_KEY = "pd_motivation_best";
const LAST_KEY = "pd_motivation_last";
const HABITS_KEY = "pd_motivation_habits";

/** Format the current date as YYYY‑MM‑DD */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Simple hook to manage a daily streak. When the user checks in,
 * the streak increments if the last check‑in was yesterday, otherwise it
 * resets to 1. The best streak is also tracked. State persists
 * automatically to localStorage.
 */
function useStreak() {
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [last, setLast] = useState<string | null>(null);

  // Load streak on mount
  useEffect(() => {
    const s = localStorage.getItem(STREAK_KEY);
    const b = localStorage.getItem(BEST_KEY);
    const l = localStorage.getItem(LAST_KEY);
    if (s) setStreak(parseInt(s, 10));
    if (b) setBest(parseInt(b, 10));
    if (l) setLast(l);
  }, []);

  /**
   * Mark today as checked in. Updates streak and best streak if
   * appropriate. Does nothing if already checked in today.
   */
  function checkIn() {
    const today = todayStr();
    if (last === today) return; // already checked in today
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const next = last === yesterday ? streak + 1 : 1;
    setStreak(next);
    localStorage.setItem(STREAK_KEY, String(next));

    const bestNext = Math.max(best, next);
    setBest(bestNext);
    localStorage.setItem(BEST_KEY, String(bestNext));

    setLast(today);
    localStorage.setItem(LAST_KEY, today);
  }

  return { streak, best, last, checkIn };
}

/** A simple horizontal progress bar. Given a value and max, displays a filled bar. */
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-3 bg-gray-200 rounded">
      <div
        className="h-3 bg-blue-600 rounded"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Determine the next badge unlock threshold based on the current streak. */
function nextTarget(streak: number) {
  if (streak < 3) return 3;
  if (streak < 7) return 7;
  if (streak < 14) return 14;
  if (streak < 30) return 30;
  // After hitting 30 days, just set the next target 7 days ahead for continuous motivation
  return streak + 7;
}

/**
 * Renders badge cards showing which milestones have been unlocked based on the current streak.
 */
function Badges({ streak }: { streak: number }) {
  const statuses = {
    "🔥 3‑Day Spark": streak >= 3,
    "🚀 7‑Day Lift‑off": streak >= 7,
    "🛡️ 14‑Day Resilience": streak >= 14,
    "🏆 30‑Day Champion": streak >= 30,
  };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(statuses).map(([label, unlocked]) => (
        <div
          key={label}
          className={
            "border rounded-xl p-4 flex flex-col items-start gap-1 " +
            (unlocked
              ? "bg-blue-50 border-blue-200"
              : "bg-white border-gray-200")
          }
        >
          <div className="text-xl leading-none">{label}</div>
          <div
            className={
              "text-sm " + (unlocked ? "text-blue-700" : "text-gray-500")
            }
          >
            {unlocked ? "Unlocked" : "Locked"}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Hook to manage simple habit toggles. Persisted to localStorage. */
function useHabits() {
  const [h, setH] = useState<{ [key: string]: boolean }>({
    study: false,
    code: false,
    apply: false,
    workout: false,
  });
  useEffect(() => {
    const saved = localStorage.getItem(HABITS_KEY);
    if (saved) setH(JSON.parse(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem(HABITS_KEY, JSON.stringify(h));
  }, [h]);
  return { h, setH };
}

export default function Motivation() {
  const { streak, best, checkIn } = useStreak();
  const { h, setH } = useHabits();
  const target = nextTarget(streak);
  const toGo = Math.max(0, target - streak);

  // List of motivational quotes. Quote of the day changes based on the date.
  const quotes = [
    "Tiny progress each day → huge results.",
    "Consistency beats intensity.",
    "Start where you are. Use what you have. Do what you can.",
    "Discipline is remembering what you want.",
  ];
  const qod = useMemo(() => {
    const today = new Date();
    const idx = today.getDate() % quotes.length;
    return quotes[idx];
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8 fade-in-up">
      <h1 className="text-3xl font-bold gradient-text">Motivation Hub</h1>

      {/* Row: Streak and Quote of the Day */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-6 bg-white shadow-sm space-y-3">
          <div className="font-semibold text-lg">Daily Check‑In</div>
          <div className="text-5xl font-mono leading-tight">{streak}</div>
          <div className="text-sm text-gray-500">Current streak</div>
          <div className="text-sm text-gray-500">Best: {best}</div>
          <button
            onClick={checkIn}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            I showed up today ✅
          </button>
          <div className="text-sm text-gray-600 mt-3">
            Next badge at <b>{target}</b> days — {toGo} to go
          </div>
          <ProgressBar value={streak} max={target} />
        </div>
        <div className="border rounded-xl p-6 bg-white shadow-sm space-y-3">
          <div className="font-semibold text-lg">Quote of the Day</div>
          <div className="italic text-gray-800 text-lg">“{qod}”</div>
          {/* Additional rotating quotes using the existing QuoteWidget */}
          <div className="text-xs text-gray-500">
            More: <QuoteWidget />
          </div>
        </div>
      </div>

      {/* Achievement badges */}
      <div className="border rounded-xl p-6 bg-white shadow-sm">
        <div className="font-semibold text-lg mb-2">Achievement Badges</div>
        <Badges streak={streak} />
      </div>

      {/* Habits toggles */}
      <div className="border rounded-xl p-6 bg-white shadow-sm">
        <div className="font-semibold text-lg mb-2">Today’s Habits</div>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["Study", "study"],
              ["Code", "code"],
              ["Apply Jobs", "apply"],
              ["Workout", "workout"],
            ] as const
          ).map(([label, key]) => (
            <button
              key={key}
              onClick={() => setH({ ...h, [key]: !h[key] })}
              className={
                "px-4 py-2 rounded border text-sm font-medium " +
                (h[key] ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-100 border-gray-300")
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Tip: check in daily and hit at least two habits to keep momentum.
        </div>
      </div>
    </div>
  );
}
