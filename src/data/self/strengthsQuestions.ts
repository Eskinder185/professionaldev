export type Likert = 1 | 2 | 3 | 4 | 5;
export type Q = { id: string; text: string; trait: "focus" | "communication" | "ownership" | "pace"; reverse?: boolean };

export const STRENGTHS_QUESTIONS: Q[] = [
  { id: "q1", text: "I finish tasks I start.", trait: "focus" },
  { id: "q2", text: "I explain ideas clearly.", trait: "communication" },
  { id: "q3", text: "I take responsibility without being asked.", trait: "ownership" },
  { id: "q4", text: "I work effectively under time pressure.", trait: "pace" },
  { id: "q5", text: "I avoid distractions and stay on track.", trait: "focus" },
  { id: "q6", text: "People often ask me to clarify what I mean.", trait: "communication", reverse: true },
  { id: "q7", text: "I own mistakes and act to fix them.", trait: "ownership" },
  { id: "q8", text: "I thrive in fast-moving environments.", trait: "pace" },
  { id: "q9", text: "I break large work into smaller steps.", trait: "focus" },
  { id: "q10", text: "I listen actively before responding.", trait: "communication" },
  { id: "q11", text: "I wait for direction before taking initiative.", trait: "ownership", reverse: true },
  { id: "q12", text: "I stay calm and productive near deadlines.", trait: "pace" },
  { id: "q13", text: "I set aside time blocks for deep work.", trait: "focus" },
  { id: "q14", text: "My written messages are concise and clear.", trait: "communication" },
  { id: "q15", text: "I volunteer to lead tasks when needed.", trait: "ownership" },
  { id: "q16", text: "Frequent context switching slows me down a lot.", trait: "pace", reverse: true },
  { id: "q17", text: "I keep notes and track decisions.", trait: "focus" },
  { id: "q18", text: "I adapt my style to my audience.", trait: "communication" },
  { id: "q19", text: "I escalate risks early with suggested options.", trait: "ownership" },
  { id: "q20", text: "I maintain steady output even when busy.", trait: "pace" }
];

