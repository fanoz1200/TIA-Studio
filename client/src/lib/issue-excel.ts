import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import type { Schedule } from "./cpm";

export const ISSUE_EXCEL_COLUMNS = [
  "رقم القضية", "عنوان القضية", "تاريخ الواقعة", "أبلغ عنها", "المسؤولية", "سبب التأخير", "الحرجية", "مدة Fragnet (يوم)", "معرف العلاقة", "الأنشطة المتأثرة", "الوصف الفني", "ملخص الأثر", "المراجع",
] as const;

export type SpreadsheetIssue = {
  issueNo: string;
  title: string;
  occurrenceDate: string;
  reportedBy?: string;
  responsibleParty: "employer" | "contractor" | "engineer" | "third_party" | "undetermined";
  delayCause: "employer" | "contractor" | "neutral";
  criticality: "unknown" | "potentially_critical" | "critical" | "noncritical";
  proposedDurationDays: number;
  replacedRelationshipId: string;
  affectedActivityIds: string[];
  description: string;
  impactSummary: string;
  referenceNotes: string;
};

export type ExcelIssueRow = SpreadsheetIssue & { rowNumber: number };
export type IssueExcelParseResult = { rows: ExcelIssueRow[]; errors: string[]; totalRows: number };

const responsibilityValues = new Set<SpreadsheetIssue["responsibleParty"]>(["employer", "contractor", "engineer", "third_party", "undetermined"]);
const causeValues = new Set<SpreadsheetIssue["delayCause"]>(["employer", "contractor", "neutral"]);
const criticalityValues = new Set<SpreadsheetIssue["criticality"]>(["unknown", "potentially_critical", "critical", "noncritical"]);

function text(value: unknown) { return String(value ?? "").trim(); }
function header(value: unknown) { return text(value).replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " "); }
function asIsoDate(value: unknown) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}` : "";
  }
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
}

function issueValues(issue: SpreadsheetIssue) {
  return [issue.issueNo, issue.title, issue.occurrenceDate, issue.reportedBy ?? "", issue.responsibleParty, issue.delayCause, issue.criticality, issue.proposedDurationDays, issue.replacedRelationshipId, issue.affectedActivityIds.join("، "), issue.description, issue.impactSummary, issue.referenceNotes];
}

function createWorkbook(rows: unknown[][], instructions?: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([Array.from(ISSUE_EXCEL_COLUMNS), ...rows]), "سجل القضايا");
  if (instructions) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), "تعليمات");
  return workbook;
}

function workbookBlob(workbook: XLSX.WorkBook) {
  return new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildIssueRegisterWorkbook(issues: Array<SpreadsheetIssue & { status?: string }>) {
  const rows = issues.map(issue => issueValues(issue));
  return createWorkbook(rows);
}

export function exportIssueRegisterExcel(issues: Array<SpreadsheetIssue & { status?: string }>) {
  download(workbookBlob(buildIssueRegisterWorkbook(issues)), "TIA-Issue-Register.xlsx");
}

const REQUIRED_ISSUE_COLUMNS = new Set<(typeof ISSUE_EXCEL_COLUMNS)[number]>(ISSUE_EXCEL_COLUMNS.filter(column => column !== "أبلغ عنها"));

/** ملف منفصل لأن المستخدم يملأه أولاً؛ لا يحتوي أي بيانات مشروع أو ملف XER. */
export async function buildIssueImportTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TIA Studio";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("سجل القضايا", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  const guidance = workbook.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  const choices = workbook.addWorksheet("القيم المسموحة", { views: [{ rightToLeft: true }] });

  sheet.columns = [
    { width: 16 }, { width: 30 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 21 },
    { width: 20 }, { width: 20 }, { width: 31 }, { width: 44 }, { width: 35 }, { width: 35 },
  ];
  const headerRow = sheet.addRow(Array.from(ISSUE_EXCEL_COLUMNS));
  headerRow.height = 34;
  headerRow.eachCell((cell, columnNumber) => {
    const column = ISSUE_EXCEL_COLUMNS[columnNumber - 1];
    const required = REQUIRED_ISSUE_COLUMNS.has(column);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FFB85C2A" : "FF277F92" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FF153D58" } } };
    cell.note = required ? "حقل مطلوب للاستيراد." : "حقل اختياري؛ اتركه فارغاً إن لم يتوفر.";
  });
  sheet.autoFilter = { from: "A1", to: "M1" };
  for (let row = 2; row <= 201; row += 1) {
    const current = sheet.getRow(row);
    current.height = 26;
    current.eachCell({ includeEmpty: true }, cell => {
      cell.alignment = { vertical: "top", horizontal: "right", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD7E5E9" } } };
    });
    sheet.getCell(`C${row}`).numFmt = "yyyy-mm-dd";
    sheet.getCell(`H${row}`).numFmt = "0.0";
    sheet.getCell(`E${row}`).dataValidation = { type: "list", allowBlank: false, formulae: ["\"employer,contractor,engineer,third_party,undetermined\""] };
    sheet.getCell(`F${row}`).dataValidation = { type: "list", allowBlank: false, formulae: ["\"employer,contractor,neutral\""] };
    sheet.getCell(`G${row}`).dataValidation = { type: "list", allowBlank: false, formulae: ["\"unknown,potentially_critical,critical,noncritical\""] };
    sheet.getCell(`H${row}`).dataValidation = { type: "decimal", operator: "greaterThan", allowBlank: false, formulae: [0], showErrorMessage: true, errorTitle: "مدة غير صحيحة", error: "اكتب مدة Fragnet أكبر من صفر وأقل من 3651 يوم عمل." };
    sheet.getCell(`C${row}`).dataValidation = { type: "date", operator: "between", allowBlank: false, formulae: [new Date(2000, 0, 1), new Date(2100, 11, 31)], showErrorMessage: true, errorTitle: "تاريخ غير صحيح", error: "اكتب تاريخ الواقعة بصيغة YYYY-MM-DD." };
  }

  guidance.columns = [{ width: 28 }, { width: 88 }];
  const instructions = [
    ["دليل قالب سجل القضايا", "البرتقالي = حقل مطلوب. الأزرق = حقل اختياري. لا تغيّر صف العناوين ولا ترتيبه."],
    ["طريقة التعبئة", "كل صف = واقعة واحدة مستقلة. بعد الرفع يراجع البرنامج كل رقم قضية، تاريخ، Activity ID، وعلاقة منطقية قبل الحفظ."],
    ["القوائم المنسدلة", "استخدم القوائم في المسؤولية وسبب التأخير والحرجية. الأكواد بالإنجليزية عمداً لأنها القيم التي يستوردها البرنامج؛ معناها العربي موجود في ورقة «القيم المسموحة»."],
    ["رقم القضية", "مطلوب وفريد، مثال: ISS-001. لا تكرر نفس الرقم في الملف."],
    ["تاريخ الواقعة", "مطلوب بصيغة YYYY-MM-DD. لا تضع تاريخ معرفة متأخر بدلاً من تاريخ حدوث الواقعة."],
    ["معرف العلاقة", "مطلوب: علاقة منطقية موجودة في البرنامج المستورد. هو موضع مقترح الـFragnet؛ لا يُطبّق شيء أثناء الاستيراد."],
    ["الأنشطة المتأثرة", "مطلوب: ضع أكثر من Activity ID بفاصلة عربية أو إنجليزية، مثال: A100، A110. يراجع البرنامج وجودها بعد الرفع."],
    ["الوصف والأثر والمراجع", "مطلوبة: اكتب الوقائع الفنية والأثر المتوقع ومرجع الدليل. القالب لا يحكم بالاستحقاق ولا يغني عن تحليل TIA ومراجعة المختص."],
    ["حدود السلامة", "الإجازات والتقويم وData Date وجودة البرنامج تُراجع داخل TIA Studio قبل تنفيذ التحليل. راجع Primavera على نسخة غير إنتاجية قبل أي استخدام مهني."],
  ];
  instructions.forEach((values, index) => {
    const row = guidance.addRow(values);
    row.height = index === 0 ? 36 : 44;
    row.eachCell(cell => { cell.alignment = { vertical: "top", horizontal: "right", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FFD7E5E9" } } }; });
    if (index === 0) row.eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF153D58" } }; });
    else row.getCell(1).font = { bold: true, color: { argb: "FF195971" } };
  });

  choices.columns = [{ width: 30 }, { width: 28 }, { width: 52 }];
  const choiceRows = [
    ["الحقل", "القيمة في القائمة", "المعنى"],
    ["المسؤولية", "employer", "صاحب العمل"], ["المسؤولية", "contractor", "المقاول"], ["المسؤولية", "engineer", "المهندس / الاستشاري"], ["المسؤولية", "third_party", "طرف ثالث"], ["المسؤولية", "undetermined", "غير محدد بعد"],
    ["سبب التأخير", "employer", "سبب من صاحب العمل"], ["سبب التأخير", "contractor", "سبب من المقاول"], ["سبب التأخير", "neutral", "سبب محايد أو عام"],
    ["الحرجية", "unknown", "لم تُحدد بعد"], ["الحرجية", "potentially_critical", "قد تكون حرجة"], ["الحرجية", "critical", "حرجة بعد المراجعة"], ["الحرجية", "noncritical", "غير حرجة"],
  ];
  choiceRows.forEach((values, index) => {
    const row = choices.addRow(values);
    row.eachCell(cell => { cell.alignment = { vertical: "middle", horizontal: "right", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FFD7E5E9" } } }; });
    if (index === 0) row.eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF277F92" } }; });
  });
  return workbook;
}

export async function downloadIssueImportTemplate() {
  const workbook = await buildIssueImportTemplateWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "TIA-Issue-Import-Template.xlsx");
}

export function parseIssueRegisterExcel(data: ArrayBuffer, schedule: Pick<Schedule, "activities" | "relationships">): IssueExcelParseResult {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.Sheets["سجل القضايا"] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [], errors: ["لا توجد ورقة عمل قابلة للقراءة في ملف Excel."], totalRows: 0 };
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const actualHeaders = (table[0] ?? []).map(header);
  const missing = ISSUE_EXCEL_COLUMNS.filter(column => !actualHeaders.includes(column));
  if (missing.length) return { rows: [], errors: [`أعمدة إلزامية مفقودة: ${missing.join("، ")}. حمّل القالب واستخدمه من دون تغيير العناوين.`], totalRows: Math.max(0, table.length - 1) };

  const index = Object.fromEntries(ISSUE_EXCEL_COLUMNS.map(column => [column, actualHeaders.indexOf(column)])) as Record<(typeof ISSUE_EXCEL_COLUMNS)[number], number>;
  const activityIds = new Set(schedule.activities.map(activity => activity.id));
  const relationshipIds = new Set(schedule.relationships.map(relationship => relationship.id));
  const rows: ExcelIssueRow[] = [];
  const errors: string[] = [];
  const issueNos = new Set<string>();
  const dataRows = table.slice(1).filter(row => row.some(cell => text(cell)));

  dataRows.forEach((source, rowOffset) => {
    const rowNumber = rowOffset + 2;
    const get = (column: (typeof ISSUE_EXCEL_COLUMNS)[number]) => source[index[column]];
    const issueNo = text(get("رقم القضية"));
    const title = text(get("عنوان القضية"));
    const occurrenceDate = asIsoDate(get("تاريخ الواقعة"));
    const reportedBy = text(get("أبلغ عنها"));
    const responsibleParty = text(get("المسؤولية")) as SpreadsheetIssue["responsibleParty"];
    const delayCause = text(get("سبب التأخير")) as SpreadsheetIssue["delayCause"];
    const criticality = text(get("الحرجية")) as SpreadsheetIssue["criticality"];
    const proposedDurationDays = Number(get("مدة Fragnet (يوم)"));
    const replacedRelationshipId = text(get("معرف العلاقة"));
    const affectedActivityIds = text(get("الأنشطة المتأثرة")).split(/[،,]/).map(item => item.trim()).filter(Boolean);
    const description = text(get("الوصف الفني"));
    const impactSummary = text(get("ملخص الأثر"));
    const referenceNotes = text(get("المراجع"));
    const prefix = `الصف ${rowNumber}`;
    if (!issueNo) errors.push(`${prefix}: رقم القضية مطلوب.`);
    else if (issueNos.has(issueNo.toUpperCase())) errors.push(`${prefix}: رقم القضية مكرر داخل الملف (${issueNo}).`);
    else issueNos.add(issueNo.toUpperCase());
    if (title.length < 3) errors.push(`${prefix}: عنوان القضية يجب أن يحتوي 3 أحرف على الأقل.`);
    if (!occurrenceDate) errors.push(`${prefix}: تاريخ الواقعة يجب أن يكون تاريخاً صالحاً بصيغة YYYY-MM-DD.`);
    if (!responsibilityValues.has(responsibleParty)) errors.push(`${prefix}: قيمة المسؤولية غير معتمدة.`);
    if (!causeValues.has(delayCause)) errors.push(`${prefix}: سبب التأخير يجب أن يكون employer أو contractor أو neutral.`);
    if (!criticalityValues.has(criticality)) errors.push(`${prefix}: قيمة الحرجية غير معتمدة.`);
    if (!Number.isFinite(proposedDurationDays) || proposedDurationDays <= 0 || proposedDurationDays > 3650) errors.push(`${prefix}: مدة Fragnet يجب أن تكون بين 0 و3650 يوم عمل.`);
    if (!relationshipIds.has(replacedRelationshipId)) errors.push(`${prefix}: معرف العلاقة «${replacedRelationshipId || "فارغ"}» غير موجود في البرنامج الحالي.`);
    if (!affectedActivityIds.length) errors.push(`${prefix}: حدد نشاطاً متأثراً واحداً على الأقل.`);
    const unknownActivities = affectedActivityIds.filter(id => !activityIds.has(id));
    if (unknownActivities.length) errors.push(`${prefix}: الأنشطة غير الموجودة في البرنامج: ${unknownActivities.join("، ")}.`);
    if (description.length < 10) errors.push(`${prefix}: الوصف الفني يجب أن يحتوي 10 أحرف على الأقل.`);
    if (impactSummary.length < 5) errors.push(`${prefix}: ملخص الأثر يجب أن يحتوي 5 أحرف على الأقل.`);
    if (referenceNotes.length < 3) errors.push(`${prefix}: المراجع يجب أن تحتوي 3 أحرف على الأقل.`);
    rows.push({ rowNumber, issueNo, title, occurrenceDate, reportedBy: reportedBy || undefined, responsibleParty, delayCause, criticality, proposedDurationDays, replacedRelationshipId, affectedActivityIds, description, impactSummary, referenceNotes });
  });
  if (!dataRows.length) errors.push("لا توجد صفوف قضايا في ورقة «سجل القضايا». أضف صفاً واحداً على الأقل بعد العناوين.");
  return { rows, errors, totalRows: dataRows.length };
}
