export default function Contact(){
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <header className="surface-muted p-6 fade-up">
        <h1 className="brand-heading text-2xl font-semibold">Contact</h1>
        <p>Questions, feedback, or ideas — I’d love to hear them.</p>
      </header>
      <div className="surface p-6 hover-glow" style={{ ["--glow" as any]: "var(--accent-blue)" }}>
        <form className="space-y-4">
          <input className="input" placeholder="Name" />
          <input className="input" placeholder="Email" />
          <textarea className="textarea" placeholder="Message" rows={5}></textarea>
          <button className="btn btn-anim btn-blue">Send</button>
        </form>
        <div className="text-sm opacity-80 mt-4">
          Social: LinkedIn · GitHub · Email
        </div>
      </div>
    </div>
  )
}

