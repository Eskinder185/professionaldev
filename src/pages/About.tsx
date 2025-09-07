export default function About(){
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6 fade-in-up">
      <h1 className="text-3xl font-bold gradient-text">About</h1>
      <p>
        Professional Development is a continuous loop: {" "}
        <b>Self‑Assess → Plan → Act → Reflect</b>. This site gives you simple tools for each stage so you can move forward with clarity.
      </p>
      <div className="border border-primary/20 rounded-xl p-6 bg-primary/10">
        <h2 className="font-semibold mb-2">The PD Cycle (simple diagram)</h2>
        <div className="text-sm">
          [ Self‑Assess ] → [ Plan ] → [ Act ] → [ Reflect ] → (repeat)
        </div>
      </div>
      <p>
        Mission: make career growth approachable, structured, and motivating — whether you're starting out or leveling up.
      </p>
    </div>
  )
}
