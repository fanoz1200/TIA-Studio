import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoots = ["/home/ubuntu/upload", "/home/ubuntu/webdev-static-assets"];
const outputJson = path.join(projectRoot, "docs", "USER_SOURCE_DUPLICATE_AUDIT.json");
const outputMarkdown = path.join(projectRoot, "docs", "USER_SOURCE_DUPLICATE_AUDIT_AR.md");
const applicationCaseLibrary = path.join(projectRoot, "client", "src", "lib", "master-claim-cases.ts");
const requestedCaseIds = Array.from({ length: 88 }, (_, index) => `D-${String(index + 1).padStart(3, "0")}`);
const extensionPattern = /\.(xlsx|xls|xlsm|html|htm)$/i;

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizeCaseId(raw) {
  const match = String(raw).match(/\bD[-‐–—]\s*0*(\d{1,3})\b/i);
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 && number <= 999 ? `D-${String(number).padStart(3, "0")}` : null;
}

function collectCaseIds(text) {
  const identifiers = new Set();
  const pattern = /\bD[-‐–—]\s*0*\d{1,3}\b/gi;
  for (const match of String(text).matchAll(pattern)) {
    const normalized = normalizeCaseId(match[0]);
    if (normalized) identifiers.add(normalized);
  }
  return [...identifiers].sort((left, right) => left.localeCompare(right, "en"));
}

function findCaseEvidence(text, caseIds) {
  const evidence = {};
  for (const caseId of caseIds) {
    const numericPart = Number(caseId.slice(2));
    const pattern = new RegExp(`\\bD[-‐–—]\\s*0*${numericPart}\\b`, "gi");
    const matches = [...String(text).matchAll(pattern)];
    evidence[caseId] = matches.slice(0, 3).map((match) => {
      const start = Math.max(0, match.index - 120);
      const end = Math.min(String(text).length, match.index + match[0].length + 200);
      return String(text).slice(start, end).replace(/\s+/g, " ").trim();
    });
  }
  return evidence;
}

function inspectWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const identifiers = new Set();
  const locations = {};
  const sheetDetails = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    let nonEmptyCellCount = 0;

    if (range) {
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        for (let column = range.s.c; column <= range.e.c; column += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: column });
          const cell = sheet[cellAddress];
          if (!cell || cell.v === undefined || cell.v === null || cell.v === "") continue;
          nonEmptyCellCount += 1;
          const value = String(cell.v);
          for (const caseId of collectCaseIds(value)) {
            identifiers.add(caseId);
            locations[caseId] ??= [];
            if (locations[caseId].length < 5) {
              locations[caseId].push(`${sheetName}!${cellAddress}: ${value.replace(/\s+/g, " ").slice(0, 180)}`);
            }
          }
        }
      }
    }

    return { sheetName, range: sheet["!ref"] ?? null, nonEmptyCellCount };
  });

  const caseIds = [...identifiers].sort((left, right) => left.localeCompare(right, "en"));
  return { sheetDetails, caseIds, caseLocations: locations };
}

function inspectHtml(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const caseIds = collectCaseIds(text);
  const structuredCaseKeys = [...text.matchAll(/(?:^|[,{\s])['"]?(D-\d{3})['"]?\s*:\s*\{/gm)]
    .map((match) => normalizeCaseId(match[1]))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
  const deduplicatedStructuredKeys = [...new Set(structuredCaseKeys)];
  const headings = [...text.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => match[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    caseIds,
    structuredCaseIds: deduplicatedStructuredKeys,
    d056ToD088Evidence: findCaseEvidence(text, requestedCaseIds.slice(55)),
    headingCount: headings.length,
    headingSamples: headings.slice(0, 12),
  };
}

function listSourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensionPattern.test(entry.name))
    .map((entry) => path.join(root, entry.name));
}

const files = sourceRoots.flatMap(listSourceFiles).sort((left, right) => left.localeCompare(right, "ar"));
const entries = files.map((filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const isWorkbook = [".xlsx", ".xls", ".xlsm"].includes(extension);
  const metadata = fs.statSync(filePath);
  const inspection = isWorkbook ? inspectWorkbook(filePath) : inspectHtml(filePath);
  return {
    path: filePath,
    filename: path.basename(filePath),
    kind: isWorkbook ? "workbook" : "html",
    sizeBytes: metadata.size,
    sha256: sha256(filePath),
    ...inspection,
  };
});

const duplicateGroups = Object.values(Object.groupBy(entries, (entry) => entry.sha256))
  .filter((group) => group.length > 1)
  .map((group) => ({ sha256: group[0].sha256, files: group.map(({ path: filePath, filename, sizeBytes }) => ({ path: filePath, filename, sizeBytes })) }));

const knownStructuredCaseIds = [...new Set(entries.flatMap((entry) => entry.structuredCaseIds ?? []))]
  .sort((left, right) => left.localeCompare(right, "en"));
const allMentionedCaseIds = [...new Set(entries.flatMap((entry) => entry.caseIds ?? []))]
  .sort((left, right) => left.localeCompare(right, "en"));
const d056ToD088Mentioned = requestedCaseIds.slice(55).filter((caseId) => allMentionedCaseIds.includes(caseId));
const applicationLibraryText = fs.readFileSync(applicationCaseLibrary, "utf8");
const applicationLibraryCaseIds = [...new Set([...applicationLibraryText.matchAll(/["']case_id["']:\s*["'](D-\d{3})["']/g)].map((match) => match[1]))]
  .sort((left, right) => left.localeCompare(right, "en"));
const sourceCasesMissingFromLibrary = knownStructuredCaseIds.filter((caseId) => !applicationLibraryCaseIds.includes(caseId));
const libraryCasesAbsentFromSources = applicationLibraryCaseIds.filter((caseId) => !knownStructuredCaseIds.includes(caseId));

const report = {
  generatedAt: new Date().toISOString(),
  scope: { sourceRoots, fileCount: entries.length },
  files: entries,
  exactDuplicateGroups: duplicateGroups,
  summary: {
    requestedRange: { first: "D-001", last: "D-088", total: requestedCaseIds.length },
    structuredCaseIds: knownStructuredCaseIds,
    structuredCaseCount: knownStructuredCaseIds.length,
    allMentionedCaseIds,
    d056ToD088Mentioned,
    d056ToD088MentionedCount: d056ToD088Mentioned.length,
  },
  applicationLibraryMatch: {
    applicationCaseLibrary,
    applicationCaseIds: applicationLibraryCaseIds,
    applicationCaseCount: applicationLibraryCaseIds.length,
    sourceCasesMissingFromLibrary,
    libraryCasesAbsentFromSources,
    exactMatch: sourceCasesMissingFromLibrary.length === 0 && libraryCasesAbsentFromSources.length === 0,
  },
};

const fileRows = entries.map((entry) => {
  const cases = entry.caseIds?.length ? entry.caseIds.join("، ") : "لا توجد معرفات D";
  const structured = entry.structuredCaseIds?.length ? entry.structuredCaseIds.join("، ") : "—";
  return `| \`${entry.filename}\` | ${entry.kind === "workbook" ? "Excel" : "HTML"} | ${entry.sizeBytes.toLocaleString("en-US")} | ${entry.caseIds?.length ?? 0} | ${entry.structuredCaseIds?.length ?? 0} | ${cases} | ${structured} |`;
});
const duplicateRows = duplicateGroups.length
  ? duplicateGroups.map((group) => `| \`${group.sha256.slice(0, 12)}…\` | ${group.files.map((file) => `\`${file.filename}\``).join("<br>")} |`).join("\n")
  : "| لا يوجد | لا توجد نسخ متطابقة بالبايت |";

const markdown = `# تدقيق نسخ مصادر المطالبات المرفوعة\n\n> **الغرض:** مراجعة قراءة فقط لكل ملفات Excel وHTML المتاحة في مجلدي الرفع والأصول، بما فيها النسخ المكررة، قبل تقرير ما إذا كانت حالات \`D-056\` إلى \`D-088\` موجودة فعلياً وقابلة للاستخراج. لا ينشئ هذا التدقيق أي حالة أو محتوى جديداً.\n\n## نطاق التدقيق\n\nتم فحص **${entries.length}** ملفاً من المصادر المتاحة.\n\n| الملف | النوع | الحجم (بايت) | معرفات D المذكورة | مفاتيح حالات منظمة | كل المعرفات المذكورة | مفاتيح الحالات المنظمة |\n|---|---:|---:|---:|---:|---|---|\n${fileRows.join("\n")}\n\n## النسخ المتطابقة تماماً\n\n| بصمة SHA-256 مختصرة | الملفات المتطابقة |\n|---|---|\n${duplicateRows}\n\n## نتيجة نطاق D-056 إلى D-088\n\nالمعرفات المذكورة في أي موضع داخل الملفات المفحوصة: **${d056ToD088Mentioned.length ? d056ToD088Mentioned.join("، ") : "لا توجد"}**.\n\nمفاتيح الحالات المنظمة المكتشفة في جميع ملفات HTML: **${knownStructuredCaseIds.length ? knownStructuredCaseIds.join("، ") : "لا توجد"}**.\n\n> لا يكفي ظهور معرف D داخل نص عابر لاعتباره حالة قابلة للدمج؛ يعتمد دمج المكتبة على سجل منظم أو صف Excel يحتوي تفاصيل قانونية وفنية قابلة للقراءة. يسجل ملف JSON المرافق مواضع ظهور D-056 إلى D-088 في كل ملف إن وجدت، لتمكين المراجعة الدقيقة.\n\n## مطابقة مكتبة التطبيق\n\nفهرس التطبيق يحتوي **${applicationLibraryCaseIds.length}** حالة. الحالات المنظمة الموجودة في المصادر وغير الموجودة في التطبيق: **${sourceCasesMissingFromLibrary.length ? sourceCasesMissingFromLibrary.join("، ") : "لا توجد"}**. الحالات الموجودة في التطبيق ولا تظهر في المصادر المنظمة: **${libraryCasesAbsentFromSources.length ? libraryCasesAbsentFromSources.join("، ") : "لا توجد"}**.\n\n> نتيجة المطابقة: **${sourceCasesMissingFromLibrary.length === 0 && libraryCasesAbsentFromSources.length === 0 ? "تطابق كامل بين المكتبة وسجلات المصدر المنظمة" : "يوجد اختلاف يحتاج معالجة قبل الادعاء باكتمال المكتبة"}**.\n\n## القرار التالي\n\nسيُطابق هذا التقرير مع مكتبة التطبيق الحالية. إذا كشف التدقيق صفوفاً أو سجلات منظمة جديدة، تُستخرج وتُختبر وتُضاف. وإذا لم يكشفها، فسيُوثق ذلك باسم كل ملف وبصمته بدلاً من طلب إعادة رفع ما هو موجود بالفعل.\n`;

fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outputMarkdown, `${markdown}\n`);
console.log(`دُقّق ${entries.length} ملفاً؛ الحالات المنظمة: ${knownStructuredCaseIds.length}؛ D-056..D-088 المذكورة: ${d056ToD088Mentioned.length}.`);
