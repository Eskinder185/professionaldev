import React from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";

export default function Contact() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact"
        sub="Questions, feedback, or ideas—reach out."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold">Send a message</h3>
          <p className="mt-1">I read every note. Expect a reply within 1–2 days.</p>
          <form className="mt-3 space-y-3">
            <input className="input" placeholder="Your email" />
            <input className="input" placeholder="Subject" />
            <textarea className="textarea" placeholder="How can I help?" />
            <button className="btn btn-anim btn-pink" type="submit">Send →</button>
          </form>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold">Links</h3>
          <ul className="mt-2 space-y-2">
            <li><a className="btn" href="mailto:you@example.com">Email</a></li>
            <li><a className="btn" href="https://www.linkedin.com/in/yourname" target="_blank" rel="noreferrer">LinkedIn</a></li>
            <li><a className="btn" href="https://github.com/yourname" target="_blank" rel="noreferrer">GitHub</a></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

