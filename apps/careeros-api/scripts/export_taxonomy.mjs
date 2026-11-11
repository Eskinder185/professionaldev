// Exports the website's skill taxonomy so the database uses exactly the same vocabulary.
//   node --experimental-strip-types scripts/export_taxonomy.mjs
// (Node 22.6+; the flag is harmless on newer versions.)
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "../../../src/features/resume/job/taxonomy.ts");
const { TAXONOMY, CASE_SENSITIVE } = await import(pathToFileURL(source).href);

const skills = [];
for (const [category, entries] of Object.entries(TAXONOMY)) {
  for (const [name, aliases = []] of entries) skills.push({ name, category, aliases, case_sensitive: CASE_SENSITIVE.has(name) });
}
const names = new Set();
for (const s of skills) {
  if (names.has(s.name.toLowerCase())) throw new Error(`Duplicate skill name across categories: ${s.name}`);
  names.add(s.name.toLowerCase());
}
const out = { source: "src/features/resume/job/taxonomy.ts", generated_by: "scripts/export_taxonomy.mjs", skills };
writeFileSync(path.resolve(here, "../data/skills.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${skills.length} skills in ${new Set(skills.map((s) => s.category)).size} categories`);
