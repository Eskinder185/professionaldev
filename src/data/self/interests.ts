export const INTEREST_QUESTIONS = [
  { id: "i1", text: "I enjoy building UIs and polishing interactions.", weights: { frontend: 2, devops: 0, cloudsec: 0 } },
  { id: "i2", text: "I like automating builds, tests, and deployments.", weights: { frontend: 0, devops: 2, cloudsec: 0 } },
  { id: "i3", text: "I’m curious about threats, logging, and hardening.", weights: { frontend: 0, devops: 0, cloudsec: 2 } },
  { id: "i4", text: "I enjoy taking designs to pixel-perfect implementation.", weights: { frontend: 2, devops: 0, cloudsec: 0 } },
  { id: "i5", text: "I find infra-as-code and pipelines satisfying.", weights: { frontend: 0, devops: 2, cloudsec: 0 } },
  { id: "i6", text: "I like learning about IAM, SOC, SIEM.", weights: { frontend: 0, devops: 0, cloudsec: 2 } },
] as const;

