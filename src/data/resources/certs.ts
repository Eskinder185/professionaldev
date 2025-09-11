export type Step = { id: string; title: string; link?: string; hours: number; type: "study" | "lab" | "practice" };
export type Path = { id: "frontend" | "devops" | "cloudsec"; title: string; exams: string[]; steps: Step[] };

export const CERT_PATHS: Path[] = [
  {
    id: "devops",
    title: "AWS DevOps-focused path",
    exams: ["SAA", "DVA or SOA", "DOP"],
    steps: [
      { id: "saa-a", title: "SAA — Core services (IAM, VPC, EC2, S3, RDS)", hours: 12, type: "study" },
      { id: "saa-b", title: "SAA — Hands-on labs (VPC + EC2 + ALB + ASG)", hours: 8, type: "lab" },
      { id: "saa-c", title: "SAA — 2 practice tests + review", hours: 6, type: "practice" },
      { id: "devops-a", title: "GitHub Actions CI/CD basics", hours: 5, type: "study" },
      { id: "devops-b", title: "IaC: Terraform crash course + module", hours: 6, type: "lab" },
      { id: "dop-a", title: "DOP — incident, logging & observability", hours: 10, type: "study" },
    ],
  },
  {
    id: "cloudsec",
    title: "Cloud Security path",
    exams: ["SAA", "Sec+", "SCS"],
    steps: [
      { id: "sec-fund", title: "Security fundamentals (CIA, IAM best practices)", hours: 6, type: "study" },
      { id: "guard", title: "AWS GuardDuty + CloudTrail lab", hours: 4, type: "lab" },
      { id: "scs-domains", title: "SCS — domains & practice sets", hours: 12, type: "practice" },
    ],
  },
  {
    id: "frontend",
    title: "Frontend path",
    exams: ["JS/TS mastery (non-cert)", "React"],
    steps: [
      { id: "ui-lib", title: "React + accessibility (a11y)", hours: 8, type: "study" },
      { id: "proj", title: "Ship a small SPA + tests", hours: 10, type: "lab" },
    ],
  },
];

