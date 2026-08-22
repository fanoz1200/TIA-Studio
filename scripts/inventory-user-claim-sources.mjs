import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const projectRoot = path.resolve(import.meta.dirname, "..");
const uploadRoot = "/home/ubuntu/upload";
const sources = {
  fidicWorkbook: path.join(uploadRoot, "pasted_file_gHGBOL_FIDIC_2017_Claims_Reference.xlsx.xlsx"),
  referenceManual: path.join(uploadRoot, "تجميعحالاتالواتسابوالقراراتبناءعليها.html"),
  masterManual: path.join(uploadRoot, "MasterClaimIntelligence—نظامذكاءالمطالباتالإنشائيةV3.0.html"),
};
const outDir = path.join(projectRoot, "docs");

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "gi"))]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
}

function extractCaseIds(html) {
  return [...new Set([...html.matchAll(/D-\d{3}/g)].map((match) => match[0]))]
    .sort((a, b) => a.localeCompare(b, "en"));
}

function extractMasterCaseIds(html) {
  const start = html.indexOf("window.CASES_DATA = {");
  const end = html.indexOf("\n};", start);
  if (start < 0 || end < 0) return [];
  const registry = html.slice(start, end + 3);
  return [...registry.matchAll(/^\s{2}'(D-\d+)': \{/gm)].map((match) => match[1]);
}

function displayList(items, emptyText = "لا يوجد") {
  return items.length ? items.join("، ") : emptyText;
}

for (const [label, filePath] of Object.entries(sources)) {
  if (!fs.existsSync(filePath)) throw new Error(`المصدر غير موجود: ${label}`);
}

const workbook = XLSX.readFile(sources.fidicWorkbook, { cellDates: false });
const workbookRows = workbook.SheetNames.flatMap((sheetName) => {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  return rows.map((row) => ({ sheetName, row }));
});
const workbookColumns = workbookRows.length ? Object.keys(workbookRows[0].row) : [];
const workbookClauses = workbookRows
  .map(({ row }) => String(row["FIDIC 2017 Clause"] ?? "").trim())
  .filter(Boolean);

const referenceHtml = fs.readFileSync(sources.referenceManual, "utf8");
const masterHtml = fs.readFileSync(sources.masterManual, "utf8");
const referenceScenarioHeadings = extractHeadings(referenceHtml, "h3").filter((heading) => heading.includes("الحالة"));
const masterRegistryIds = extractMasterCaseIds(masterHtml);
const masterAllIds = extractCaseIds(masterHtml);
const masterNonRegistryIds = masterAllIds.filter((id) => !masterRegistryIds.includes(id));
const requestedIds = Array.from({ length: 88 }, (_, index) => `D-${String(index + 1).padStart(3, "0")}`);
const missingRequestedIds = requestedIds.filter((id) => !masterRegistryIds.includes(id));

const inventory = {
  generatedAt: new Date().toISOString(),
  sources: {
    fidicWorkbook: {
      filename: path.basename(sources.fidicWorkbook),
      sheets: workbook.SheetNames,
      recordCount: workbookRows.length,
      columns: workbookColumns,
      clauseCount: workbookClauses.length,
      clauses: workbookClauses,
      dCaseIds: workbookClauses.filter((value) => /^D-\d{3}$/.test(value)),
    },
    referenceManual: {
      filename: path.basename(sources.referenceManual),
      h2Sections: extractHeadings(referenceHtml, "h2"),
      scenarioHeadings: referenceScenarioHeadings,
      dCaseIds: extractCaseIds(referenceHtml),
    },
    masterManual: {
      filename: path.basename(sources.masterManual),
      registryCaseIds: masterRegistryIds,
      registryCaseCount: masterRegistryIds.length,
      nonRegistryDIds: masterNonRegistryIds,
    },
  },
  requestedCaseRange: {
    first: "D-001",
    last: "D-088",
    availableRegistryCases: masterRegistryIds.length,
    missingRequestedIds,
  },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "user-source-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);

const markdown = `# جرد مصادر مكتبة المطالبات المرفوعة\n\n> **غرض الجرد:** توثيق ما هو موجود فعلياً في الملفات التي رفعها المستخدم قبل دمجه في التطبيق. هذه النتيجة لا تضيف حالات افتراضية ولا تفترض أن أرقام البنود تعادل معرفات حالات المكتبة.\n\n## المصادر المفحوصة\n\n| المصدر | البنية المكتشفة | النتيجة القابلة للدمج |\n|---|---|---|\n| \`${inventory.sources.fidicWorkbook.filename}\` | ورقة واحدة و${inventory.sources.fidicWorkbook.recordCount} سجلاً، مع ${inventory.sources.fidicWorkbook.clauseCount} بند FIDIC 2017 | مرجع تعاقدي مستقل قابل للبحث والربط بالحالات، وليس سجلاً لمعرفات \`D-###\`. |\n| \`${inventory.sources.referenceManual.filename}\` | ${inventory.sources.referenceManual.h2Sections.length} أقسام رئيسية و${inventory.sources.referenceManual.scenarioHeadings.length} سيناريوهات بعنوان «الحالة» | دليل تعليمي/منهجي يمكن عرضه كمرجع تطبيق ومساندة لمسار التحليل. |\n| \`${inventory.sources.masterManual.filename}\` | سجل \`CASES_DATA\` مهيكل | يحتوي ${inventory.sources.masterManual.registryCaseCount} حالة مكتبية مهيكلة صالحة للاستخراج. |\n\n## نتيجة نطاق الحالات D\n\nالموسوعة المهيكلة تحتوي: **${displayList(inventory.sources.masterManual.registryCaseIds)}**.\n\nالمعرفات الظاهرة خارج سجل \`CASES_DATA\`: **${displayList(inventory.sources.masterManual.nonRegistryDIds)}**. لا تُعامل هذه المعرفات كحالات مكتبة مضمونة قبل فحص معناها في المصدر.\n\n> لم يُعثر في المصادر الثلاثة على حالات مهيكلة جديدة من **D-056** إلى **D-088**. لذلك ستبقى هذه المعرفات غير متاحة داخل عداد مكتبة الحالات إلى أن يرد مصدر يتضمن صفوفها أو سجلها المهيكل فعلاً.\n\n## بنود FIDIC المتاحة\n\n${displayList(inventory.sources.fidicWorkbook.clauses)}\n\n## سيناريوهات الدليل التعليمي\n\n${inventory.sources.referenceManual.scenarioHeadings.map((heading, index) => `${index + 1}. ${heading}`).join("\n")}\n\n## قرار الدمج\n\nسيُدمج ملف Excel كـ**مرجع بنود FIDIC 2017** له حقول عملية للأدلة والإجراء التخطيطي والمراجع القانونية المصرية، وسيُدمج الدليل المرجعي كمواد تعلم وتوجيه. أما فهرس الحالات D الحالي فسيظل قائماً على سجل الحالات المهيكل فقط؛ وبذلك لا يُخلط رقم بند عقدي أو مثال تدريبي مع معرف حالة تحليل مستقل.\n`;

fs.writeFileSync(path.join(outDir, "USER_SOURCE_INVENTORY_AR.md"), `${markdown}\n`);

console.log(`تم جرد ${workbookRows.length} سجلاً تعاقدياً و${masterRegistryIds.length} حالة مهيكلة.`);
