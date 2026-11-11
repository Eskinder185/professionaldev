import { getLocal, setLocal } from "../../hooks/useLocal";

export interface CoverLetter {
  id: string;
  name: string;
  text: string;
  /** Job posting (CareerOS job store) this letter was written for, if any. */
  jobId: string | null;
  company: string;
  role: string;
  favorite: boolean;
  isDefault: boolean;
  /** "upload" letters keep only the extracted text, not the original file. */
  origin: "written" | "upload" | "ai-draft";
  createdAt: string;
  updatedAt: string;
}

export const LETTERS_KEY = "pd:careeros:cover-letters";
const EVENT = "pd:letters-changed";

export const loadLetters = (): CoverLetter[] => {
  const raw = getLocal<CoverLetter[]>(LETTERS_KEY, []);
  return Array.isArray(raw) ? raw.filter((l) => l && typeof l.id === "string") : [];
};

export function saveLetters(letters: CoverLetter[]): void {
  setLocal(LETTERS_KEY, letters);
  window.dispatchEvent(new Event(EVENT));
}

export function newLetter(partial: Partial<CoverLetter> = {}): CoverLetter {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: "Untitled cover letter", text: "", jobId: null, company: "", role: "", favorite: false, isDefault: false, origin: "written", createdAt: now, updatedAt: now, ...partial };
}

export { EVENT as LETTERS_EVENT };

export function letterToPdf(letter: CoverLetter, jsPDFCtor: new (o: object) => { setFont: (f: string) => void; setFontSize: (n: number) => void; splitTextToSize: (t: string, w: number) => string[]; text: (t: string | string[], x: number, y: number) => void; addPage: () => void; output: (t: "arraybuffer") => ArrayBuffer }): ArrayBuffer {
  const doc = new jsPDFCtor({ unit: "pt", format: "letter" });
  doc.setFont("helvetica");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(letter.text.replace(/[^\x20-\x7E\n\xA0-ÿ]/g, "?"), 468);
  let y = 72;
  for (const line of lines) {
    if (y > 720) {
      doc.addPage();
      y = 72;
    }
    doc.text(line, 72, y);
    y += 15;
  }
  return doc.output("arraybuffer");
}
