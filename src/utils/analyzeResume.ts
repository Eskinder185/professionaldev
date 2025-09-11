export type ResumeAnalysis = {
  score: number;
  breakdown: { label: string; score: number; note: string }[];
  suggestions: string[];
  detected: {
    emails: string[];
    phones: string[];
    links: string[];
    bullets: number;
    words: number;
  };
};

const ACTION_VERBS = [
  "built","created","led","shipped","designed","implemented","launched","optimized",
  "migrated","automated","improved","reduced","increased","mentored","owned","delivered"
];

export function analyzeResume(text: string, targetKeywords: string[] = []): ResumeAnalysis {
  const t = text.replace(/\s+/g," ").trim();
  const words = t ? t.split(" ").length : 0;
  const bullets = (text.match(/(^|\n)\s*[\u2022\-•]/g) || []).length;

  const emails = Array.from(t.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map(m=>m[0]);
  const phones = Array.from(t.matchAll(/(\+?\d[\d\s\-().]{7,}\d)/g)).map(m=>m[0]);
  const links  = Array.from(t.matchAll(/\b(https?:\/\/[^\s)]+)\b/gi)).map(m=>m[1]);

  const hasSections = /(experience|education|projects|skills|summary|certifications)/i.test(t);
  const hasMetrics  = /(\d+%|\$\d+|\d{3,})/.test(t);
  const verbHits    = ACTION_VERBS.filter(v => new RegExp(`\\b${v}\\b`,`i`).test(t)).length;
  const kwHits      = targetKeywords.filter(k => new RegExp(`\\b${k}\\b`,`i`).test(t)).length;

  const parts = [
    { label:"Structure",    score: hasSections ? 18 : 6,                 note: hasSections ? "Has standard sections" : "Add Experience/Education/Skills" },
    { label:"Bullets",      score: Math.min(12, bullets*2),              note: bullets>6 ? "Good use of bullets" : "Use concise bullets" },
    { label:"Action verbs", score: Math.min(14, verbHits*2),             note: verbHits>5 ? "Strong verbs present" : "Start bullets with strong verbs" },
    { label:"Metrics",      score: hasMetrics ? 14 : 6,                  note: hasMetrics ? "Quantified impact" : "Add numbers: %, $, counts" },
    { label:"Keywords",     score: Math.min(18, kwHits*3),               note: kwHits>3 ? "Matches target role" : "Mirror job description keywords" },
    { label:"Contact/Links",score: (emails.length?6:2)+(links.length?6:2),note: emails.length&&links.length?"Contact + links": "Add email + LinkedIn/GitHub/Portfolio" },
    { label:"Length",       score: words<900?12:6,                       note: words<900 ? "Likely ≤1 page" : "Trim to 1 page for junior roles" },
  ];
  const score = Math.round(parts.reduce((a,b)=>a+b.score,0));

  const suggestions: string[] = [];
  if (!hasMetrics) suggestions.push("Add metrics (%, $, counts, scope) to show impact.");
  if (verbHits < 6) suggestions.push("Start bullets with strong action verbs (built, shipped, optimized…).");
  if (kwHits < 4 && targetKeywords.length) suggestions.push("Mirror the job description keywords (skills, tools, role terms).");
  if (!emails.length) suggestions.push("Include a professional email in the header.");
  if (!links.find(l=>/github\.com/i.test(l))) suggestions.push("Add a GitHub repository or portfolio link.");
  if (words > 900) suggestions.push("Cut filler; keep to one page unless senior.");
  if (bullets < 6) suggestions.push("Use bullets for readability over paragraphs.");
  return { score, breakdown: parts, suggestions, detected:{emails,phones,links,bullets,words} };
}

