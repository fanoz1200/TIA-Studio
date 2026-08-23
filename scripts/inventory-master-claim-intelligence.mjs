import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const projectRoot = path.resolve(import.meta.dirname, "..");
const uploadPath = "/home/ubuntu/upload/pasted_file_pJ8TCu_Master_Claim_Intelligence.xlsx";
const docsDir = path.join(projectRoot, "docs");

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableUnique(values) {
  return [...new Set(values.filter(Boolean))];
}

function columnLabel(index) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function extractCellLinks(sheet, range) {
  const links = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[address];
      if (!cell?.l?.Target) continue;
      links.push({
        cell: address,
        label: cleanText(cell.v),
        target: cell.l.Target,
      });
    }
  }
  return links;
}

function summarizeSheet(sheetName, sheet) {
  const ref = sheet["!ref"];
  if (!ref) {
    return { sheetName, range: null, populatedRows: 0, populatedColumns: 0, headers: [], preview: [], hyperlinks: [], dCaseIds: [] };
  }

  const range = XLSX.utils.decode_range(ref);
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const populatedRows = matrix.filter((row) => row.some((value) => cleanText(value))).length;
  const firstContentRow = matrix.find((row) => row.some((value) => cleanText(value))) ?? [];
  const values = matrix.flat().map(cleanText).filter(Boolean);
  const dCaseIds = stableUnique(values.flatMap((value) => value.match(/D-\d{3}/g) ?? [])).sort((a, b) => a.localeCompare(b, "en"));
  const formulas = Object.values(sheet).filter((cell) => cell && typeof cell === "object" && "f" in cell).length;
  const hyperlinks = extractCellLinks(sheet, range);

  return {
    sheetName,
    range: ref,
    populatedRows,
    populatedColumns: range.e.c - range.s.c + 1,
    headers: firstContentRow.map((value, index) => ({ column: columnLabel(index), value: cleanText(value) })).filter((entry) => entry.value),
    preview: matrix.filter((row) => row.some((value) => cleanText(value))).slice(0, 8).map((row) => row.map(cleanText)),
    formulaCount: formulas,
    hyperlinks,
    dCaseIds,
  };
}

if (!fs.existsSync(uploadPath)) {
  throw new Error(`لم يُعثر على ملف Excel الجديد في: ${uploadPath}`);
}

const workbook = XLSX.readFile(uploadPath, { cellDates: false, cellFormula: true, cellHTML: false });
const summaries = workbook.SheetNames.map((sheetName) => summarizeSheet(sheetName, workbook.Sheets[sheetName]));
const inventory = {
  generatedAt: new Date().toISOString(),
  source: {
    filename: path.basename(uploadPath),
    sizeBytes: fs.statSync(uploadPath).size,
    sheetCount: workbook.SheetNames.length,
    sheets: summaries,
  },
  totals: {
    dCaseIds: stableUnique(summaries.flatMap((summary) => summary.dCaseIds)).sort((a, b) => a.localeCompare(b, "en")),
    hyperlinkCount: summaries.reduce((sum, summary) => sum + summary.hyperlinks.length, 0),
    formulaCount: summaries.reduce((sum, summary) => sum + summary.formulaCount, 0),
  },
};

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, "master-claim-intelligence-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);

const markdown = `# جرد ملف Master Claim Intelligence الجديد

> **مبدأ القراءة:** هذا التقرير يصف الملف المرفوع كما هو قبل دمج أي نص أو قاعدة في تطبيق TIA Studio. لا يحول رقم بند أو رابطاً أو مثالاً إلى استحقاق قانوني تلقائي.

| الخاصية | النتيجة |
|---|---|
| الملف | \`${inventory.source.filename}\` |
| الحجم | ${inventory.source.sizeBytes.toLocaleString("en-US")} بايت |
| عدد الأوراق | ${inventory.source.sheetCount} |
| الصيغ المكتشفة | ${inventory.totals.formulaCount} |
| الارتباطات التشعبية | ${inventory.totals.hyperlinkCount} |
| معرفات D الظاهرة | ${inventory.totals.dCaseIds.join("، ") || "لا يوجد"} |

## بنية الأوراق

${summaries.map((summary) => `### ${summary.sheetName}

| النطاق | صفوف ذات محتوى | الأعمدة | الصيغ | الروابط |
|---|---:|---:|---:|---:|
| ${summary.range ?? "فارغة"} | ${summary.populatedRows} | ${summary.populatedColumns} | ${summary.formulaCount} | ${summary.hyperlinks.length} |

**رؤوس أو أول صف محتوى:** ${summary.headers.map((header) => `\`${header.column}\`: ${header.value}`).join("؛ ") || "لا يوجد"}.

**معرفات D الظاهرة:** ${summary.dCaseIds.join("، ") || "لا يوجد"}.

**معاينة أولية للصفوف:**

${summary.preview.map((row) => `- ${row.filter(Boolean).join(" | ")}`).join("\n") || "- لا توجد صفوف ذات محتوى."}

${summary.hyperlinks.length ? `**الروابط:**\n\n${summary.hyperlinks.map((link) => `- \`${link.cell}\`: ${link.label || "رابط"} → ${link.target}`).join("\n")}` : ""}`).join("\n\n")}

## القرار التالي

سيُستخدم هذا الجرد لمقارنة حقول الملف ببيانات المكتبة الحالية، ثم لدمج النصوص والعلاقات الموثقة فقط في نموذج بيانات قابل للتجديد والاختبار. لا تُنقل مكتبات أو أكواد خارجية قبل فحص ترخيصها وأمنها وتوافقها مع محرك CPM/Fragnet المحلي.
`;

fs.writeFileSync(path.join(docsDir, "MASTER_CLAIM_INTELLIGENCE_INVENTORY_AR.md"), `${markdown}\n`);
console.log(`تم جرد ${inventory.source.sheetCount} ورقة و${inventory.totals.dCaseIds.length} معرفات D و${inventory.totals.hyperlinkCount} رابطاً.`);
