import * as XLSX from "xlsx";
import type { Fragnet, Schedule, TiaResult, WindowTiaResult } from "./cpm";
import type { ScheduleQualityAssessment } from "./schedule-quality";

export type AnalysisExcelPayload = {
  schedule: Schedule;
  quality: ScheduleQualityAssessment;
  analysis: TiaResult | WindowTiaResult;
  events: Fragnet[];
  narrative: string;
};

function impactDays(analysis: TiaResult | WindowTiaResult) {
  return "totalImpactDays" in analysis ? analysis.totalImpactDays : analysis.impactDays;
}

export function buildAnalysisWorkbook({ schedule, quality, analysis, events, narrative }: AnalysisExcelPayload) {
  const book = XLSX.utils.book_new();
  const baseline = analysis.baseline;
  const impacted = analysis.impacted;
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["تقرير تحليل التأخير — TIA Studio"],
    ["المشروع", schedule.name], ["مصدر البرنامج", schedule.source ?? "غير محدد"],
    ["حالة بوابة الجودة", quality.analysisReadiness], ["نتيجة الجودة", quality.summary],
    ["تاريخ خط الأساس", baseline.completionDate], ["تاريخ ما بعد الحدث", impacted.completionDate],
    ["الأثر المحسوب (يوم عمل)", impactDays(analysis)], ["عدد الأنشطة", schedule.activities.length],
    ["عدد العلاقات", schedule.relationships.length], ["حدود الاستخدام", "فحص بنيوي داخلي؛ راجع الملف في Primavera والمستندات والعقد قبل اتخاذ قرار أو تقديم مطالبة."],
    ["السرد", narrative],
  ]), "الملخص");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(schedule.activities.map((a) => ({
    "معرف النشاط": a.id, "اسم النشاط": a.name, "المدة": a.duration, "البداية المخططة": a.plannedStart ?? "",
    "نوع النشاط": a.kind ?? "base", "WBS": a.wbsId ?? a.wbs ?? "", "نسبة الإنجاز": a.percentComplete ?? "", "المدة المتبقية": a.remainingDuration ?? "",
  }))), "الأنشطة");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(schedule.relationships.map((r) => ({
    "معرف العلاقة": r.id, "السابق": r.predecessorId, "اللاحق": r.successorId, "النوع": r.type, "Lag": r.lag ?? 0,
  }))), "العلاقات");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(events.map((e) => ({
    "معرف الحدث": e.id, "العنوان": e.title, "تاريخ الوقوع": e.occurrenceDate, "السبب": e.cause, "أنشطة Fragnet": e.activities.length,
  }))), "الأحداث");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(quality.rules.map((rule) => ({
    "المعرف": rule.id, "القاعدة": rule.title, "الحالة": rule.severity, "الإجراء المطلوب": rule.action, "التفصيل": rule.detail,
  }))), "فحص الجودة");
  return book;
}

export function exportAnalysisExcel(payload: AnalysisExcelPayload) {
  const data = XLSX.write(buildAnalysisWorkbook(payload), { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "TIA-Analysis-Workbook.xlsx"; anchor.click(); URL.revokeObjectURL(url);
}
