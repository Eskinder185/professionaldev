import type { Extracted } from "./extractTextFromFile";

export type ResumeAnalysis = {
  score: number;
  breakdown: { label: string; score: number; note: string }[];
  suggestions: string[];
  detected: {
    emails: string[];
    phones: string[];
    links: string[];
    linkedin: string | null;
    location: string | null;   // City, ST or similar
    titleGuess: string | null; // headline role guess
    bullets: number;
    words: number;
    sections: Record<string, boolean>;
  };
  typography: {
    available: boolean;
    bodySizePt?: number;          // median body font size (pt approx)
    headingSizesPt?: number[];    // top unique sizes > body
    lineSpacingRatio?: number;    // median line gap / body size
    fontCandidates?: string[];    // from PDF font names
    verdicts: string[];           // human-readable results
  };
};

const ACTION_VERBS = [
  "built","created","led","shipped","designed","implemented","launched","optimized",
  "migrated","automated","improved","reduced","increased","mentored","owned","delivered"
];

export function analyzeResume(extracted: Extracted, targetKeywords: string[] = []): ResumeAnalysis {
  const text = extracted.text;
  const t = text.replace(/\s+/g," ").trim();
  const words = t ? t.split(" ").length : 0;
  const bullets = (text.match(/(^|\n)\s*[\u2022\-•]/g) || []).length;

  const emails = Array.from(t.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map(m=>m[0]);
  const phones = Array.from(t.matchAll(/(\+?\d[\d\s\-().]{7,}\d)/g)).map(m=>m[0]);
  const links  = Array.from(t.matchAll(/\b(https?:\/\/[^\s)]+)\b/gi)).map(m=>m[1]);
  const linkedin = links.find(l => /linkedin\.com/i.test(l)) || null;
  const location = Array.from(t.matchAll(/[\w\s]+,\s*[A-Z]{2}/g)).map(m=>m[0])[0] || null;
  const titleGuess = null; // TODO: Extract role from first section

  const sections = {
    experience: /experience|work/i.test(t),
    education: /education|academic/i.test(t),
    projects: /project/i.test(t),
    skills: /skill|technolog/i.test(t),
    summary: /summary|profile|objective/i.test(t),
    certs: /certification|qualification/i.test(t)
  };

  const hasSections = Object.values(sections).some(v => v);
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
  // Analyze typography if PDF items available
  // Helper for median calculation
  const median = (nums: number[]): number => {
    const sorted = [...nums].sort((a,b) => a-b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid-1] + sorted[mid]) / 2 
      : sorted[mid];
  };

  const typography: ResumeAnalysis["typography"] = { available: false, verdicts: [] };
  if (extracted.kind === "pdf") {
    typography.available = true;
    const sizes = extracted.items.map(it => it.size).filter(s => s > 0);
    const bodySizePt = sizes.length ? Math.round(median(sizes)) : undefined;
    if (bodySizePt) {
      typography.bodySizePt = bodySizePt;
      // Find heading sizes (larger than body)
      const larger = [...new Set(sizes.filter(s => s > bodySizePt + 1))].sort((a,b) => b-a);
      if (larger.length) typography.headingSizesPt = larger;
    }

    // Get unique fonts (filtering out undefined)
    const fonts = [...new Set(extracted.items.map(it => it.font).filter((f): f is string => !!f))];
    if (fonts.length) typography.fontCandidates = fonts;

    // Calculate line spacing by looking at Y gaps between text at same size
    const bySize: Record<number,number[]> = {};
    for (const it of extracted.items) {
      if (it.size <= 0) continue;
      if (!bySize[it.size]) bySize[it.size] = [];
      bySize[it.size].push(it.y);
    }
    // Get median line gap for the most common size
    const [mostCommonSize] = Object.entries(bySize)
      .sort(([,a],[,b]) => b.length - a.length)[0] || [];
    if (mostCommonSize) {
      const size = parseFloat(mostCommonSize);
      const ys = bySize[size].sort((a,b) => a-b);
      const gaps = [];
      for (let i = 1; i < ys.length; i++) {
        const gap = Math.abs(ys[i] - ys[i-1]);
        if (gap > 0 && gap < size * 3) gaps.push(gap); // Filter outliers
      }
      if (gaps.length) {
        typography.lineSpacingRatio = Math.round((median(gaps) / size) * 10) / 10;
      }
    }

    // Add human-readable verdicts
    const v = typography.verdicts;
    if (typography.bodySizePt) {
      if (typography.bodySizePt < 10) v.push("Body text is small (<10pt)");
      else if (typography.bodySizePt > 12) v.push("Body text is large (>12pt)");
    }
    if (!typography.headingSizesPt?.length) {
      v.push("No clear section headings (by size)");
    }
    if (typography.lineSpacingRatio) {
      if (typography.lineSpacingRatio < 1.15) v.push("Text appears cramped (<1.15x)");
      else if (typography.lineSpacingRatio > 1.5) v.push("Line spacing is loose (>1.5x)");
    }
  }

  return { 
    score, 
    breakdown: parts, 
    suggestions, 
    detected: {
      emails,
      phones,
      links,
      linkedin,
      location,
      titleGuess,
      bullets,
      words,
      sections
    },
    typography
  };
}

