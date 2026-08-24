import * as XLSX from "xlsx";
import type { Fragnet, Schedule, TiaResult, WindowTiaResult } from "./cpm";
import type { ScheduleQualityAssessment } from "./schedule-quality";
import type { DocumentLanguage } from "./language";

export type AnalysisExcelPayload = {
  schedule: Schedule;
  quality: ScheduleQualityAssessment;
  analysis: TiaResult | WindowTiaResult;
  events: Fragnet[];
  narrative: string;
  language?: DocumentLanguage;
};

function impactDays(analysis: TiaResult | WindowTiaResult) {
  return "totalImpactDays" in analysis ? analysis.totalImpactDays : analysis.impactDays;
}

export function buildAnalysisWorkbook({ schedule, quality, analysis, events, narrative, language = "ar" }: AnalysisExcelPayload) {
  const english = language === "en";
  const book = XLSX.utils.book_new();
  const baseline = analysis.baseline;
  const impacted = analysis.impacted;
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    [english ? "Delay Analysis Report — TIA Studio" : "تقرير تحليل التأخير — TIA Studio"],
    [english ? "Project" : "المشروع", schedule.name], [english ? "Schedule source" : "مصدر البرنامج", schedule.source ?? (english ? "Not specified" : "غير محدد")],
    [english ? "Quality-gate state" : "حالة بوابة الجودة", quality.analysisReadiness], [english ? "Quality summary" : "نتيجة الجودة", quality.summary],
    [english ? "Baseline finish" : "تاريخ خط الأساس", baseline.completionDate], [english ? "Finish after impact" : "تاريخ ما بعد الحدث", impacted.completionDate],
    [english ? "Calculated impact (working days)" : "الأثر المحسوب (يوم عمل)", impactDays(analysis)], [english ? "Activity count" : "عدد الأنشطة", schedule.activities.length],
    [english ? "Relationship count" : "عدد العلاقات", schedule.relationships.length], [english ? "Use limitation" : "حدود الاستخدام", english ? "Internal structural check only; review the file in Primavera, together with the documents and contract, before a decision or claim submission." : "فحص بنيوي داخلي؛ راجع الملف في Primavera والمستندات والعقد قبل اتخاذ قرار أو تقديم مطالبة."],
    [english ? "Narrative" : "السرد", narrative],
  ]), english ? "Summary" : "الملخص");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(schedule.activities.map((a) => ({
    [english ? "Activity ID" : "معرف النشاط"]: a.id, [english ? "Activity name" : "اسم النشاط"]: a.name, [english ? "Duration" : "المدة"]: a.duration, [english ? "Planned start" : "البداية المخططة"]: a.plannedStart ?? "",
    [english ? "Activity type" : "نوع النشاط"]: a.kind ?? "base", WBS: a.wbsId ?? a.wbs ?? "", [english ? "Percent complete" : "نسبة الإنجاز"]: a.percentComplete ?? "", [english ? "Remaining duration" : "المدة المتبقية"]: a.remainingDuration ?? "",
  }))), english ? "Activities" : "الأنشطة");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(schedule.relationships.map((r) => ({
    [english ? "Relationship ID" : "معرف العلاقة"]: r.id, [english ? "Predecessor" : "السابق"]: r.predecessorId, [english ? "Successor" : "اللاحق"]: r.successorId, [english ? "Type" : "النوع"]: r.type, Lag: r.lag ?? 0,
  }))), english ? "Relationships" : "العلاقات");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(events.map((e) => ({
    [english ? "Event ID" : "معرف الحدث"]: e.id, [english ? "Title" : "العنوان"]: e.title, [english ? "Occurrence date" : "تاريخ الوقوع"]: e.occurrenceDate, [english ? "Cause" : "السبب"]: e.cause, [english ? "Fragnet activities" : "أنشطة Fragnet"]: e.activities.length,
  }))), english ? "Events" : "الأحداث");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(quality.rules.map((rule) => ({
    [english ? "ID" : "المعرف"]: rule.id, [english ? "Rule" : "القاعدة"]: rule.title, [english ? "State" : "الحالة"]: rule.severity, [english ? "Required action" : "الإجراء المطلوب"]: rule.action, [english ? "Detail" : "التفصيل"]: rule.detail,
  }))), english ? "Quality gate" : "فحص الجودة");
  return book;
}

export function exportAnalysisExcel(payload: AnalysisExcelPayload) {
  const data = XLSX.write(buildAnalysisWorkbook(payload), { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "TIA-Analysis-Workbook.xlsx"; anchor.click(); URL.revokeObjectURL(url);
}
