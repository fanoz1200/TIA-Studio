import fs from "node:fs";
import path from "node:path";

const sourcePath = "/home/ubuntu/upload/Master_Claim_Intelligence_HTML.html";
const outputPath = "/home/ubuntu/tia-delay-analysis/client/src/lib/master-claim-cases.ts";
const html = fs.readFileSync(sourcePath, "utf8");
const start = html.indexOf("window.CASES_DATA = {");
const end = html.indexOf("\n};", start);

if (start < 0 || end < 0) throw new Error("لم يُعثر على سجل CASES_DATA في ملف الموسوعة.");

const source = html.slice(start, end + 3);
const blocks = [...source.matchAll(/^\s{2}'(D-\d+)': \{\n([\s\S]*?)^\s{2}\},?$/gm)];
const fields = [
  "case_id",
  "title_ar",
  "title_en",
  "category",
  "delay_type",
  "methodology",
  "description",
  "root_cause",
  "schedule_impact",
  "contractual_basis",
  "burden_of_proof",
];

const decodeJsString = value => value
  .replace(/\\n/g, "\n")
  .replace(/\\'/g, "'")
  .replace(/\\\\/g, "\\");

const cases = blocks.map(([, id, block]) => {
  const entry = { id };
  for (const field of fields) {
    const fieldMatch = block.match(new RegExp(`^\\s{4}${field}: '((?:\\\\.|[^'\\\\])*)',?`, "m"));
    entry[field] = fieldMatch ? decodeJsString(fieldMatch[1]) : "";
  }
  return entry;
});

if (cases.length !== 55 || cases.some(item => !item.title_ar || !item.description)) {
  throw new Error(`فشل استخراج فهرس الحالات الكامل: استُخرجت ${cases.length} حالة.`);
}

const header = `/**\n * Generated from the user-provided Master Claim Intelligence HTML source.\n * The original HTML remains read-only under /home/ubuntu/upload and is not stored in the database.\n */\n\n`;
const types = `export type MasterClaimCase = {\n  id: string;\n  case_id: string;\n  title_ar: string;\n  title_en: string;\n  category: string;\n  delay_type: string;\n  methodology: string;\n  description: string;\n  root_cause: string;\n  schedule_impact: string;\n  contractual_basis: string;\n  burden_of_proof: string;\n};\n\n`;
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${header}${types}export const masterClaimCases: MasterClaimCase[] = ${JSON.stringify(cases, null, 2)} as const;\n`);
console.log(`Generated ${cases.length} cases at ${outputPath}`);
