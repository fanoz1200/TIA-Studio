import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const projectRoot = path.resolve(import.meta.dirname, "..");
const uploadRoot = "/home/ubuntu/upload";
const workbookPath = path.join(uploadRoot, "pasted_file_gHGBOL_FIDIC_2017_Claims_Reference.xlsx.xlsx");
const scenariosPath = path.join(uploadRoot, "تجميعحالاتالواتسابوالقراراتبناءعليها.html");
const outputPath = path.join(projectRoot, "client/src/lib/user-claim-references.ts");

function asText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function htmlToText(html) {
  return asText(String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n\s*\n+/g, "\n")
    .trim());
}

if (!fs.existsSync(workbookPath) || !fs.existsSync(scenariosPath)) {
  throw new Error("تعذر توليد مراجع المستخدم لأن أحد المصدرين المرفوعين غير متاح.");
}

const workbook = XLSX.readFile(workbookPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const fidicReferences = rows.map((row) => ({
  clause: asText(row["FIDIC 2017 Clause"]),
  title: asText(row["Clause Title"]),
  adjustment: asText(row["Adjustment (T/C/M)"]),
  plannerSummary: asText(row["شرح البند (Planner View)"]),
  plannerAction: asText(row["Planner Action (عمليًا)"]),
  evidence: asText(row["Evidence / Records"]),
  egyptianLawReference: asText(row["Egyptian Law Reference"]),
  practicalNotes: asText(row["Detailed Practical Notes"]),
  source: "FIDIC 2017 Claims Reference.xlsx",
})).filter((item) => item.clause && item.title);

const html = fs.readFileSync(scenariosPath, "utf8");
const scenarios = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h[23][^>]*>|$)/gi)]
  .map((match, index) => ({
    id: `raw-scenario-${index + 1}`,
    title: htmlToText(match[1]),
    content: htmlToText(match[2]),
    source: "تجميع حالات الواتساب والقرارات بناء عليها.html",
  }))
  .filter((item) => item.title.includes("الحالة") && item.content)
  .map((item, index) => ({ ...item, id: `scenario-${index + 1}` }));

const file = `/**\n * Generated from the user-provided FIDIC workbook and Arabic reference manual.\n * Do not edit manually; run pnpm content:refresh after replacing the source files.\n */\n\nexport type FidicClaimReference = {\n  clause: string;\n  title: string;\n  adjustment: string;\n  plannerSummary: string;\n  plannerAction: string;\n  evidence: string;\n  egyptianLawReference: string;\n  practicalNotes: string;\n  source: string;\n};\n\nexport type ClaimTrainingScenario = {\n  id: string;\n  title: string;\n  content: string;\n  source: string;\n};\n\nexport const fidicClaimReferences: FidicClaimReference[] = ${JSON.stringify(fidicReferences, null, 2)} as const;\n\nexport const claimTrainingScenarios: ClaimTrainingScenario[] = ${JSON.stringify(scenarios, null, 2)} as const;\n`;

fs.writeFileSync(outputPath, file);
console.log(`تم توليد ${fidicReferences.length} بند FIDIC و${scenarios.length} سيناريوهات تدريبية.`);
