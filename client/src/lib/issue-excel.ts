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

export function downloadIssueImportTemplate() {
  const instructions = [
    ["تعليمات استيراد سجل القضايا"],
    ["لا تغيّر أسماء الأعمدة أو ترتيبها في ورقة «سجل القضايا»."],
    ["القيم المسموح بها — المسؤولية", "employer | contractor | engineer | third_party | undetermined"],
    ["القيم المسموح بها — سبب التأخير", "employer | contractor | neutral"],
    ["القيم المسموح بها — الحرجية", "unknown | potentially_critical | critical | noncritical"],
    ["الأنشطة المتأثرة", "افصل معرفات الأنشطة بفاصلة إنجليزية أو عربية. يجب أن تكون موجودة في البرنامج الحالي."],
    ["معرف العلاقة", "يجب أن يكون معرف علاقة منطقية موجودة في البرنامج الحالي. لا يُطبق أي Fragnet عند الاستيراد."],
    ["ملخص الأثر", "حقل إلزامي يشرح الأثر المتوقع على الزمن أو التسلسل أو المسار الحرج، ولا يغني عن حساب TIA."],
    ["المراجع", "حقل إلزامي للمحاضر أو بنود العقد أو أرقام الأدلة أو المراسلات ذات الصلة."],
  ];
  download(workbookBlob(createWorkbook([], instructions)), "TIA-Issue-Import-Template.xlsx");
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
