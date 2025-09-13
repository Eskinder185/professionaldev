import React from "react";
import { Link } from "react-router-dom";

type Block = {
  title: string;
  points: string[];
};

function Section({
  id, emoji, title, glow, blocks, tags
}: {
  id: string;
  emoji: string;
  title: string;
  glow: string;           // CSS color value
  blocks: Block[];
  tags?: string[];
}) {
  return (
    <section id={id} className="surface p-5 hover-glow fade-up" style={{ ["--glow" as any]: glow }}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{emoji}</div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {tags && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map(t => <span key={t} className="chip">{t}</span>)}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {blocks.map(b => (
          <div key={b.title} className="surface-muted p-4 rounded-xl">
            <h3 className="font-semibold">{b.title}</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              {b.points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Certs() {
  return (
    <div className="space-y-6">
      <header className="surface-muted p-6 fade-up">
        <h1 className="brand-heading text-2xl font-semibold">Certifications & Learning</h1>
        <p>Very important, job-ready pointers for four tracks. Use the table of contents to jump between sections.</p>
      </header>

      {/* TOC */}
      <nav className="surface p-4 rounded-2xl fade-up">
        <div className="flex flex-wrap gap-2">
          <a href="#cloud" className="btn btn-anim btn-pink">☁️ Cloud</a>
          <a href="#datasci" className="btn btn-anim btn-pink">📊 Data Science</a>
          <a href="#dev" className="btn btn-anim btn-pink">💻 Developer</a>
          <a href="#security" className="btn btn-anim btn-pink">🛡️ Security</a>
          <Link to="/Resources" className="btn">← Back to Resources</Link>
        </div>
      </nav>

      {/* CLOUD */}
      <Section
        id="cloud"
        emoji="☁️"
        title="Cloud (AWS · Azure · GCP)"
        glow="var(--accent-blue)"
        tags={["certifications","hands-on labs","IaC","cost"]}
        blocks={[
          {
            title: "Key certs (start → specialize)",
            points: [
              "AWS: Cloud Practitioner → Solutions Architect Associate → (DevOps/Security/Developer) Specialty",
              "Azure: AZ-900 Fundamentals → AZ-104 Admin / AZ-204 Developer",
              "GCP: Associate Cloud Engineer → Professional Cloud Architect/Developer"
            ]
          },
          {
            title: "Must-know skills",
            points: [
              "Core services: compute, storage, networking, identity (IAM/Policies/RBAC).",
              "IaC: Terraform basics (providers, state, modules) + CI/CD deploy.",
              "Containers: Docker images, logs, health checks; basic Kubernetes (pods, services, deployments).",
              "Observability: metrics, logs, tracing; cost basics (budgets, tags/labels)."
            ]
          },
          {
            title: "Labs (do these!)",
            points: [
              "Deploy a 3-tier app with IaC (VPC/VNet, compute, managed DB, load balancer).",
              "Add autoscaling + HTTPS + blue/green or rolling deployments.",
              "Wire monitoring/alerts; set a monthly budget + anomaly alert."
            ]
          },
          {
            title: "Portfolio & interviews",
            points: [
              "Repo with Terraform/K8s manifests + README architecture diagram.",
              "Benchmark: 'from zero to live' in < 45 minutes (scripted).",
              "Be ready to whiteboard IAM least-privilege & network boundaries."
            ]
          }
        ]}
      />

      {/* DATA SCIENCE */}
      <Section
        id="datasci"
        emoji="📊"
        title="Data Science / Analytics / ML"
        glow="var(--accent-violet)"
        tags={["python","sql","ml","metrics"]}
        blocks={[
          {
            title: "Foundation first",
            points: [
              "Python: pandas, numpy, matplotlib; clean notebooks → scripts.",
              "SQL: joins, windows, CTEs; write queries that scale.",
              "Stats: distributions, hypothesis tests, confidence intervals, A/B basics."
            ]
          },
          {
            title: "Models & MLOps (practical)",
            points: [
              "Supervised basics: linear/logistic, trees, ensembles; evaluation (ROC-AUC, F1).",
              "Feature pipelines; train/val/test split; leakage prevention.",
              "MLOps: version datasets/models, save artifacts, simple API for inference."
            ]
          },
          {
            title: "Labs (do these!)",
            points: [
              "Build an end-to-end notebook → CLI → API for one dataset (house prices, churn…).",
              "Create dashboards with 3 metrics that matter; explain trade-offs.",
              "Ship a small model to a cloud function/VM and test latency."
            ]
          },
          {
            title: "Portfolio & interviews",
            points: [
              "Case study READMEs: problem → data → method → results (with charts).",
              "Reproduce a public paper or Kaggle baseline and beat it by a small margin.",
              "Explain failure modes (bias, drift, leakage) in plain language."
            ]
          }
        ]}
      />

      {/* DEVELOPER */}
      <Section
        id="dev"
        emoji="💻"
        title="Developer (Frontend/Backend/Full-stack)"
        glow="var(--accent-blue)"
        tags={["ds&a","testing","performance","ci/cd"]}
        blocks={[
          {
            title: "Core competencies",
            points: [
              "Data structures & algorithms at a practical level (arrays, hashes, trees, BFS/DFS).",
              "Clean code: modules, typing, error handling; API design (REST first, know GraphQL).",
              "Testing: unit + integration + e2e; mock external deps; coverage targets with judgment."
            ]
          },
          {
            title: "Production skills",
            points: [
              "Performance: measure first; profiles; budget bundle size; cache strategies.",
              "Security hygiene: authN/Z, parameterized queries, secrets handling, OWASP Top 10.",
              "CI/CD: build/test/lint gates; preview environments; feature flags & migrations."
            ]
          },
          {
            title: "Labs (do these!)",
            points: [
              "Ship a feature with branch → PR → review → deploy; include e2e tests.",
              "Add logging/metrics; track an error from log to fix via a dashboard.",
              "Implement a background job (queue) and retry policy."
            ]
          },
          {
            title: "Portfolio & interviews",
            points: [
              "3 projects: 1 polished product, 1 technical demo (e.g., auth/queue), 1 learning project.",
              "READMEs that show impact: perf numbers, users, before/after.",
              "Tell one story per project using STAR/CARL with concrete metrics."
            ]
          }
        ]}
      />

      {/* SECURITY */}
      <Section
        id="security"
        emoji="🛡️"
        title="Security (Blue/Red/Cloud Sec fundamentals)"
        glow="var(--accent-orange)"
        tags={["compTIA","cloud sec","threat modeling","hardening"]}
        blocks={[
          {
            title: "Certs (choose path)",
            points: [
              "Foundations: CompTIA Security+ (broad base).",
              "Blue team: CySA+ / Azure SC-900 / AWS Security Specialty (cloud focus).",
              "AppSec: focus on OWASP Top 10 + secure SDLC."
            ]
          },
          {
            title: "Must-know skills",
            points: [
              "Identity first: MFA, least privilege, key rotation, short-lived creds.",
              "Network segmentation, WAF/CDN basics, TLS, secrets management.",
              "Threat modeling: assets → threats → mitigations; logging & incident response."
            ]
          },
          {
            title: "Labs (do these!)",
            points: [
              "Harden a small web app: headers (CSP), rate limits, input validation.",
              "Create a cloud IAM policy with least privilege + break-glass role.",
              "Build a simple detection: alert on suspicious auth or public S3/container."
            ]
          },
          {
            title: "Portfolio & interviews",
            points: [
              "Write postmortems for 2 simulated incidents (timeline, root cause, fix).",
              "Show a 'before/after' hardening checklist with measurable outcomes.",
              "Explain risk vs. cost trade-offs; know when to push back."
            ]
          }
        ]}
      />
    </div>
  );
}