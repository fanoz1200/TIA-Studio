/**
 * مُصدّر XER تبادلي محدود. يكتب الجداول التي يستطيع TIA Studio استعادتها
 * (PROJECT / CALENDAR / PROJWBS / TASK / TASKPRED) ولا يدّعي تكافؤ نسخة P6 كاملة.
 */
import JSZip from "jszip";
import { addWorkingDays, runCPM, type Fragnet, type Schedule } from "./cpm";
import { buildP6ReconciliationManifest, serializeP6ReconciliationManifest } from "./p6-reconciliation-manifest";
import { importXerBytes, importXerSchedule } from "./xer";
import { applyConservativeXerBytePatch, applyConservativeXerPatch, parseXerDocument, xerTableBlocks, type XerDocumentRow, type XerTableBlock } from "./xer-format";

export type XerExportResult = {
  content: string;
  fileName: string;
  warnings: string[];
  activityCount: number;
  relationshipCount: number;
};

export type XerRoundTripCheck = {
  state: "ready" | "review" | "blocked";
  activityCount: number;
  relationshipCount: number;
  messages: string[];
};

const hoursPerDayFallback = 8;

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

function line(marker: "%T" | "%F" | "%R", cells: unknown[]) {
  return `${marker}\t${cells.map(cleanCell).join("\t")}`;
}

function p6Date(date: string | undefined, time: "08:00" | "16:00") {
  return date ? `${date} ${time}` : "";
}

function fileName(schedule: Schedule, snapshot: "pre-tia" | "post-tia") {
  const safe = schedule.name.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 72) || "TIA-Schedule";
  return `${safe}-${snapshot.toUpperCase()}.xer`;
}

/**
 * ينشئ ملف XER صغيراً قابلاً للاستيراد إلى TIA Studio. قد تطلب إصدارات Primavera
 * حقولاً أو أنماط تقاويم إضافية، لذلك يجب فتح الناتج ومراجعته في بيئة P6 منفصلة قبل
 * استخدامه كبرنامج رسمي أو كبديل للملف المصدر.
 */
export function exportExperimentalXer(schedule: Schedule, snapshot: "pre-tia" | "post-tia" = "pre-tia"): XerExportResult {
  const cpm = runCPM(schedule);
  const metricsById = new Map(cpm.activities.map((activity) => [activity.id, activity]));
  const hoursPerDay = schedule.calendar?.hoursPerDay ?? hoursPerDayFallback;
  const sourceWbs = schedule.wbsNodes?.length
    ? schedule.wbsNodes
    : [{ id: "TIA-ROOT", code: "TIA", name: "TIA Studio Export", path: "TIA Studio Export" }];
  const wbsIdBySourceId = new Map(sourceWbs.map((node, index) => [node.id, String(index + 1)]));
  const fallbackWbsId = "1";
  const rows: string[] = [
    line("%T", ["PROJECT"]),
    line("%F", ["proj_id", "proj_short_name", "proj_name", "plan_start_date", "last_recalc_date", "clndr_id"]),
    line("%R", ["1", schedule.name.slice(0, 40), schedule.name, p6Date(schedule.startDate, "08:00"), p6Date(schedule.dataDate ?? schedule.startDate, "08:00"), "1"]),
    "%E",
    line("%T", ["CALENDAR"]),
    line("%F", ["clndr_id", "clndr_name", "proj_id", "day_hr_cnt"]),
    line("%R", ["1", schedule.calendar?.name ?? "TIA Studio calendar", "1", hoursPerDay]),
    "%E",
    line("%T", ["PROJWBS"]),
    line("%F", ["wbs_id", "proj_id", "wbs_short_name", "wbs_name", "parent_wbs_id"]),
    ...sourceWbs.map((node, index) => line("%R", [wbsIdBySourceId.get(node.id) ?? String(index + 1), "1", node.code ?? node.id, node.name, node.parentId ? wbsIdBySourceId.get(node.parentId) ?? "" : ""])),
    "%E",
    line("%T", ["TASK"]),
    line("%F", ["task_id", "proj_id", "wbs_id", "clndr_id", "phys_complete_pct", "complete_pct_type", "task_type", "duration_type", "status_code", "task_code", "task_name", "total_float_hr_cnt", "free_float_hr_cnt", "remain_drtn_hr_cnt", "target_drtn_hr_cnt", "act_start_date", "act_end_date", "late_start_date", "late_end_date", "early_start_date", "early_end_date", "responsible_mgr_id"]),
  ];

  schedule.activities.forEach((activity, index) => {
    const metrics = metricsById.get(activity.id);
    if (!metrics) throw new Error(`تعذر إيجاد قياس CPM للنشاط «${activity.id}» عند تصدير XER.`);
    const earlyStart = addWorkingDays(schedule.startDate, metrics.earlyStart, schedule.calendar);
    const earlyEnd = addWorkingDays(schedule.startDate, metrics.earlyFinish, schedule.calendar);
    const lateStart = addWorkingDays(schedule.startDate, metrics.lateStart, schedule.calendar);
    const lateEnd = addWorkingDays(schedule.startDate, metrics.lateFinish, schedule.calendar);
    const percent = activity.percentComplete ?? 0;
    const completeType = activity.percentCompleteType === "physical" ? "CP_Phys" : activity.percentCompleteType === "units" ? "CP_Units" : "CP_Drtn";
    const sourceWbsId = activity.wbsId ?? sourceWbs.find((node) => node.path === activity.wbs || node.code === activity.wbs)?.id;
    rows.push(line("%R", [
      String(index + 1), "1", sourceWbsId ? wbsIdBySourceId.get(sourceWbsId) ?? fallbackWbsId : fallbackWbsId, "1", percent, completeType,
      activity.duration === 0 ? "TT_Mile" : "TT_Task", activity.duration === 0 ? "DT_FixedDrtn" : "DT_FixedDUR2", activity.actualFinish ? "TK_Complete" : activity.actualStart ? "TK_Active" : "TK_NotStart",
      activity.id, activity.name, metrics.totalFloat * hoursPerDay, metrics.freeFloat * hoursPerDay, (activity.remainingDuration ?? activity.duration) * hoursPerDay, activity.duration * hoursPerDay,
      p6Date(activity.actualStart, "08:00"), p6Date(activity.actualFinish, "16:00"), p6Date(lateStart, "08:00"), p6Date(lateEnd, "16:00"), p6Date(earlyStart, "08:00"), p6Date(earlyEnd, "16:00"), activity.owner,
    ]));
  });

  rows.push("%E", line("%T", ["TASKPRED"]), line("%F", ["task_pred_id", "task_id", "pred_task_id", "proj_id", "pred_proj_id", "pred_type", "lag_hr_cnt"]));
  const exportedTaskId = new Map(schedule.activities.map((activity, index) => [activity.id, String(index + 1)]));
  schedule.relationships.forEach((relationship, index) => {
    const successor = exportedTaskId.get(relationship.successorId);
    const predecessor = exportedTaskId.get(relationship.predecessorId);
    if (!successor || !predecessor) throw new Error(`توجد علاقة «${relationship.id}» تشير إلى نشاط غير موجود؛ صحح شبكة CPM قبل تصدير XER.`);
    rows.push(line("%R", [String(index + 1), successor, predecessor, "1", "1", `PR_${relationship.type}`, (relationship.lag ?? 0) * hoursPerDay]));
  });
  rows.push("%E");

  return {
    content: `${rows.join("\r\n")}\r\n`,
    fileName: fileName(schedule, snapshot),
    activityCount: schedule.activities.length,
    relationshipCount: schedule.relationships.length,
    warnings: [
      "ملف XER تبادلي تجريبي: يتضمن PROJECT وCALENDAR وPROJWBS وTASK وTASKPRED فقط.",
      "لا يتضمن نمط تقويم P6 المشفر أو الموارد أو التكاليف أو القيود أو الخطوط الأساسية أو الحقول المخصصة أو الحقول الأمنية؛ لذلك أي قيود XER مستوردة ستُسقط عمداً من هذا التصدير التجريبي.",
      "افتحه في نسخة Primavera منفصلة وتحقق من الأعداد والعلاقات والتواريخ قبل استعماله في عمل رسمي؛ لا يستبدل ملف P6 المصدر.",
    ],
  };
}

/**
 * يتحقق من أن ملف التبادل الذي أنشأه التطبيق يمكن قراءته ثانيةً بواسطة قارئ XER المحلي.
 * لا يثبت ذلك قبوله في كل إصدار من Primavera؛ بل يمنع تنزيل ملف أخفق في سلامة البنية
 * أو فقد عدداً من الأنشطة أو العلاقات مقارنةً بما كتبه المُصدّر.
 */
export function validateExperimentalXerRoundTrip(output: XerExportResult): XerRoundTripCheck {
  try {
    const imported = importXerSchedule(output.content, output.fileName);
    const messages: string[] = [];
    if (imported.summary.activitiesRead !== output.activityCount) messages.push(`فشل تطابق الأنشطة بعد الاستيراد العكسي: صُدّر ${output.activityCount} وقُرئ ${imported.summary.activitiesRead}.`);
    if (imported.summary.relationshipsRead !== output.relationshipCount) messages.push(`فشل تطابق العلاقات بعد الاستيراد العكسي: صُدّر ${output.relationshipCount} وقُرئ ${imported.summary.relationshipsRead}.`);
    const requiredTables = ["PROJECT", "CALENDAR", "PROJWBS", "TASK", "TASKPRED"];
    const missingTables = requiredTables.filter((table) => !imported.summary.tablesFound.includes(table));
    if (missingTables.length) messages.push(`لم تُقرأ جداول التبادل المطلوبة: ${missingTables.join("، ")}.`);
    if (messages.length) return { state: "blocked", activityCount: imported.summary.activitiesRead, relationshipCount: imported.summary.relationshipsRead, messages };

    const reviewMessages = imported.summary.warnings.map((warning) => `مراجعة الاستيراد العكسي: ${warning}`);
    reviewMessages.push("نجح فحص البنية والأعداد داخل TIA Studio؛ افتح الناتج في نسخة Primavera منفصلة قبل استعماله رسمياً.");
    return {
      state: reviewMessages.length > 1 ? "review" : "ready",
      activityCount: imported.summary.activitiesRead,
      relationshipCount: imported.summary.relationshipsRead,
      messages: reviewMessages,
    };
  } catch (error) {
    return {
      state: "blocked",
      activityCount: 0,
      relationshipCount: 0,
      messages: [error instanceof Error ? `تعذّر الاستيراد العكسي: ${error.message}` : "تعذّر الاستيراد العكسي لملف XER التجريبي."],
    };
  }
}

export type PrimaveraReferenceCheck = "match" | "mismatch" | "unknown";

export type PrimaveraCalendarReference = {
  id: string;
  name?: string;
  type?: string;
  baseCalendarId?: string;
  sourceHoursPerDay?: number;
  sourceHoursPerWeek?: number;
  sourceHoursPerMonth?: number;
  sourceHoursPerYear?: number;
  hasEncodedData: boolean;
};

export type PrimaveraCalendarMatchAssessment = {
  state: "review" | "blocked";
  sourceCalendarCount: number;
  projectCalendarId?: string;
  taskCalendarIds: string[];
  localCalendar: { id?: string; name?: string; hoursPerDay?: number };
  projectCalendar?: PrimaveraCalendarReference;
  /** مؤشرات نصية في clndr_data فقط؛ لا تفك ترميز P6 ولا تعيّن ساعات أو استثناءات. */
  encodedCalendarData: {
    state: "present" | "not-found";
    calendarsWithEncodedData: number;
    projectCalendarHasEncodedData: boolean;
    calendarRowsWithPlainDateMarkers: number;
    plainDateMarkerCount: number;
  };
  hoursPerDay: { state: PrimaveraReferenceCheck; source?: number; local?: number };
  dataDate: { state: PrimaveraReferenceCheck; source?: string; local?: string };
  inheritance: { state: "not-referenced" | "review" | "unresolved"; baseCalendarId?: string };
  messages: string[];
};

export type PreservedXerExportResult = {
  state: "ready" | "blocked";
  fileName: string;
  /** بايتات التنزيل؛ هي المرجع الوحيد للنسخ المحافظة، لا rawText الخاص بالـparser. */
  bytes?: Uint8Array;
  messages: string[];
  addedTaskIds: string[];
  addedRelationshipIds: string[];
  calendarAssignmentId?: string;
  localRoundTrip?: XerRoundTripCheck;
};

export type PreservedEventPackageResult = {
  blob: Blob;
  fileName: string;
  events: Array<{ eventId: string; state: "ready" | "blocked"; messages: string[] }>;
  messages: string[];
};

const requiredTaskFields = ["task_id", "proj_id", "wbs_id", "clndr_id", "task_code", "task_name", "target_drtn_hr_cnt", "remain_drtn_hr_cnt", "task_type", "duration_type", "status_code"];
const requiredPredecessorFields = ["task_pred_id", "task_id", "pred_task_id", "proj_id", "pred_proj_id", "pred_type", "lag_hr_cnt"];

function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 72);
  return cleaned || fallback;
}

function preservedFileName(schedule: Schedule, event: Fragnet, snapshot: "PRE-TIA" | "POST-TIA") {
  return `${safeFilePart(schedule.name, "TIA-Schedule")}--${safeFilePart(event.id, "EVENT")}--${snapshot}.xer`;
}

function blockedPreservedResult(schedule: Schedule, event: Fragnet, snapshot: "PRE-TIA" | "POST-TIA", messages: string[]): PreservedXerExportResult {
  return { state: "blocked", fileName: preservedFileName(schedule, event, snapshot), messages, addedTaskIds: [], addedRelationshipIds: [] };
}

function positiveNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function nextNumericIds(existing: string[], count: number, label: string) {
  if (existing.some((id) => !/^\d+$/.test(id))) return { error: `قيم ${label} في ملف XER ليست أرقاماً صريحة؛ أوقف الحقن المحافظ حتى لا يُنشأ معرف داخلي غير صالح في P6.` };
  const highest = Math.max(0, ...existing.map(Number));
  return { values: Array.from({ length: count }, (_, index) => String(highest + index + 1)) };
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  return Array.from(new Set(values.filter((value) => seen.has(value) || !seen.add(value))));
}

function missingFields(table: XerTableBlock, fields: string[]) {
  return fields.filter((field) => !table.headerFields.includes(field));
}

function dateFreeTaskCells(table: XerTableBlock, activity: Fragnet["activities"][number], taskId: string, projectId: string, calendarId: string, wbsId: string, hoursPerDay: number) {
  const durationHours = Math.max(0, activity.duration) * hoursPerDay;
  const values: Record<string, string | number> = {
    task_id: taskId,
    proj_id: projectId,
    wbs_id: wbsId,
    clndr_id: calendarId,
    task_code: activity.id,
    task_name: activity.name,
    target_drtn_hr_cnt: durationHours,
    remain_drtn_hr_cnt: durationHours,
    task_type: activity.duration === 0 ? "TT_Mile" : "TT_Task",
    duration_type: activity.duration === 0 ? "DT_FixedDrtn" : "DT_FixedDUR2",
    status_code: "TK_NotStart",
    phys_complete_pct: 0,
    complete_pct: 0,
    complete_pct_type: "CP_Drtn",
  };
  return table.headerFields.map((field) => values[field] ?? "");
}

function predecessorCells(table: XerTableBlock, relationship: Fragnet["relationships"][number], relationshipId: string, taskIdByLogicalId: Map<string, string>, projectId: string, hoursPerDay: number) {
  const values: Record<string, string | number> = {
    task_pred_id: relationshipId,
    task_id: taskIdByLogicalId.get(relationship.successorId) ?? "",
    pred_task_id: taskIdByLogicalId.get(relationship.predecessorId) ?? "",
    proj_id: projectId,
    pred_proj_id: projectId,
    pred_type: `PR_${relationship.type}`,
    lag_hr_cnt: (relationship.lag ?? 0) * hoursPerDay,
  };
  return table.headerFields.map((field) => values[field] ?? "");
}

function sourceNumber(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function comparableDate(value: string | undefined) {
  const match = value?.trim().match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0];
}

function inspectEncodedCalendarData(rows: XerDocumentRow[], projectCalendarId?: string) {
  const rowsWithData = rows.filter((row) => Boolean(row.values.clndr_data));
  const dateMarker = /\b(?:19|20)\d{2}[-/]\d{2}[-/]\d{2}\b/g;
  const dateMarkersByRow = rowsWithData.map((row) => row.values.clndr_data.match(dateMarker)?.length ?? 0);
  return {
    state: rowsWithData.length ? "present" as const : "not-found" as const,
    calendarsWithEncodedData: rowsWithData.length,
    projectCalendarHasEncodedData: rowsWithData.some((row) => row.values.clndr_id === projectCalendarId),
    calendarRowsWithPlainDateMarkers: dateMarkersByRow.filter(Boolean).length,
    plainDateMarkerCount: dateMarkersByRow.reduce((total, count) => total + count, 0),
  };
}

/**
 * قراءة تحفظية فقط لتقويم Primavera: تثبت وجود المصدر وتطابق المعرفات وساعات اليوم وData Date
 * عند قابلية القراءة، لكنها لا تفك clndr_data أو inheritance؛ لذلك لا يجوز اعتبارها شهادة تطابق
 * تواريخ أو Float مع P6.
 */
export function assessPrimaveraCalendarMatch(schedule: Schedule): PrimaveraCalendarMatchAssessment {
  const source = schedule.xerSource;
  const localCalendar = { id: schedule.calendar?.id, name: schedule.calendar?.name, hoursPerDay: schedule.calendar?.hoursPerDay };
  const unknownHours = { state: "unknown" as const, local: localCalendar.hoursPerDay };
  const unknownDataDate = { state: "unknown" as const, local: schedule.dataDate };
  if (!source) return { state: "blocked", sourceCalendarCount: 0, taskCalendarIds: [], localCalendar, encodedCalendarData: { state: "not-found", calendarsWithEncodedData: 0, projectCalendarHasEncodedData: false, calendarRowsWithPlainDateMarkers: 0, plainDateMarkerCount: 0 }, hoursPerDay: unknownHours, dataDate: unknownDataDate, inheritance: { state: "not-referenced" }, messages: ["لا توجد نسخة XER أصلية محفوظة في هذه الجلسة؛ لا يمكن فحص مرجع Primavera أو تنزيل Pre مطابق."] };

  const document = parseXerDocument(source.rawText);
  const projects = xerTableBlocks(document, "PROJECT").flatMap((table) => table.rows);
  const calendars = xerTableBlocks(document, "CALENDAR").flatMap((table) => table.rows);
  const calendarIds = new Set(calendars.map((row) => row.values.clndr_id).filter(Boolean));
  const encodedCalendarData = inspectEncodedCalendarData(calendars, source.projectCalendarId);
  const hasEncodedData = encodedCalendarData.state === "present";
  const projectCalendarRow = calendars.find((row) => row.values.clndr_id === source.projectCalendarId);
  const projectCalendar = projectCalendarRow ? {
    id: projectCalendarRow.values.clndr_id,
    name: projectCalendarRow.values.clndr_name || projectCalendarRow.values.calendar_name || undefined,
    type: projectCalendarRow.values.clndr_type || undefined,
    baseCalendarId: projectCalendarRow.values.base_clndr_id || undefined,
    sourceHoursPerDay: sourceNumber(projectCalendarRow.values.day_hr_cnt),
    sourceHoursPerWeek: sourceNumber(projectCalendarRow.values.week_hr_cnt),
    sourceHoursPerMonth: sourceNumber(projectCalendarRow.values.month_hr_cnt),
    sourceHoursPerYear: sourceNumber(projectCalendarRow.values.year_hr_cnt),
    hasEncodedData: Boolean(projectCalendarRow.values.clndr_data),
  } satisfies PrimaveraCalendarReference : undefined;
  const hoursPerDay = projectCalendar?.sourceHoursPerDay === undefined || localCalendar.hoursPerDay === undefined
    ? { state: "unknown" as const, source: projectCalendar?.sourceHoursPerDay, local: localCalendar.hoursPerDay }
    : { state: projectCalendar.sourceHoursPerDay === localCalendar.hoursPerDay ? "match" as const : "mismatch" as const, source: projectCalendar.sourceHoursPerDay, local: localCalendar.hoursPerDay };
  const sourceDataDate = projects[0]?.values.last_recalc_date || projects[0]?.values.data_date || undefined;
  const comparableSourceDataDate = comparableDate(sourceDataDate);
  const comparableLocalDataDate = comparableDate(schedule.dataDate);
  const dataDate = comparableSourceDataDate && comparableLocalDataDate
    ? { state: comparableSourceDataDate === comparableLocalDataDate ? "match" as const : "mismatch" as const, source: sourceDataDate, local: schedule.dataDate }
    : { state: "unknown" as const, source: sourceDataDate, local: schedule.dataDate };
  const baseCalendarId = projectCalendar?.baseCalendarId;
  const inheritance = !baseCalendarId
    ? { state: "not-referenced" as const }
    : calendarIds.has(baseCalendarId)
      ? { state: "review" as const, baseCalendarId }
      : { state: "unresolved" as const, baseCalendarId };
  const messages: string[] = [];
  if (!calendars.length) messages.push("ملف المصدر لا يحتوي جدول CALENDAR صالحاً؛ يجب إيقاف اعتماد مطابقة التقويم.");
  if (!source.projectCalendarId) messages.push("لم يظهر PROJECT.clndr_id في المصدر؛ تعيين تقويم المشروع يحتاج مراجعة داخل P6.");
  else if (!calendarIds.has(source.projectCalendarId)) messages.push(`PROJECT.clndr_id=${source.projectCalendarId} لا يشير إلى صف CALENDAR مقروء.`);
  if (source.taskCalendarIds.some((id) => !calendarIds.has(id))) messages.push("يوجد TASK.clndr_id لا يشير إلى CALENDAR مقروء؛ لا تعتمد الحساب المحلي.");
  if (source.taskCalendarIds.length > 1) messages.push("المصدر يعيّن أكثر من تقويم نشاط؛ محرك TIA Studio المحلي لا يفك التقويم لكل نشاط.");
  if (!hasEncodedData) messages.push("لم يظهر clndr_data مشفر في CALENDAR؛ راجع اكتمال تصدير P6 قبل أي مطابقة.");
  else {
    messages.push(`توجد clndr_data مشفرة في ${encodedCalendarData.calendarsWithEncodedData} من ${calendars.length} تقاويم${encodedCalendarData.projectCalendarHasEncodedData ? "، ومنها تقويم المشروع" : ""}. وجودها لا يعني أنها فُكت أو طابقت P6.`);
    if (encodedCalendarData.plainDateMarkerCount) messages.push(`ظهرت ${encodedCalendarData.plainDateMarkerCount} علامة تاريخ نصية داخل clndr_data عبر ${encodedCalendarData.calendarRowsWithPlainDateMarkers} تقاويم. قد ترتبط باستثناءات، لكن التطبيق لا يفسرها ولا يبني منها أيام عمل.`);
  }
  if (hoursPerDay.state === "mismatch") messages.push(`فرق ساعات اليوم: CALENDAR.day_hr_cnt=${hoursPerDay.source} بينما تقويم TIA Studio المحلي=${hoursPerDay.local}. لا تعتمد حسابات الأيام أو Float المحلية لهذا الملف.`);
  else if (hoursPerDay.state === "unknown") messages.push("تعذرت مقارنة ساعات اليوم لأن CALENDAR.day_hr_cnt أو تقويم TIA Studio المحلي غير مكتمل.");
  if (dataDate.state === "mismatch") messages.push(`فرق Data Date: المصدر=${dataDate.source} والجدول المحلي=${dataDate.local}. راجع النسخة الصحيحة قبل التحليل.`);
  else if (dataDate.state === "unknown") messages.push("لم يمكن إثبات تطابق Data Date بصيغة تاريخ قابلة للمقارنة؛ راجعه داخل P6.");
  if (inheritance.state === "unresolved") messages.push(`يشير base_clndr_id=${inheritance.baseCalendarId} إلى تقويم أساس غير مقروء؛ لا تعتمد التقويم المحلي.`);
  else if (inheritance.state === "review") messages.push(`يوجد تقويم أساس base_clndr_id=${inheritance.baseCalendarId} محفوظ في المصدر، لكن وراثة P6 لا تُفك محلياً.`);
  messages.push("تم الاحتفاظ بـ CALENDAR حرفياً في Pre/Post، لكن لا تزال مطابقة التواريخ والـ Float مع Primavera P6 مشروطة بفتح Post وإجراء Schedule/F9 ومقارنة النتائج.");
  const sourceStructureReady = Boolean(calendars.length && source.projectCalendarId && calendarIds.has(source.projectCalendarId) && source.taskCalendarIds.every((id) => calendarIds.has(id)));
  return {
    state: sourceStructureReady && hoursPerDay.state !== "mismatch" && dataDate.state !== "mismatch" && inheritance.state !== "unresolved" ? "review" : "blocked",
    sourceCalendarCount: calendars.length,
    projectCalendarId: source.projectCalendarId,
    taskCalendarIds: source.taskCalendarIds,
    localCalendar,
    projectCalendar,
    encodedCalendarData,
    hoursPerDay,
    dataDate,
    inheritance,
    messages,
  };
}

/** يعيد الأصل حرفياً، مع اسم حدث واضح. لا يعيد تشغيل أو إعادة تسلسل أي جدول XER. */
export function exportPreservedPreXer(schedule: Schedule, event: Fragnet): PreservedXerExportResult {
  const source = schedule.xerSource;
  if (!source?.rawBytes?.length) return blockedPreservedResult(schedule, event, "PRE-TIA", ["بايتات ملف XER الأصلي غير متاحة في ذاكرة هذه الجلسة. أعد استيراد ملف XER نفسه قبل التنزيل المحافظ."]);
  return {
    state: "ready",
    fileName: preservedFileName(schedule, event, "PRE-TIA"),
    bytes: new Uint8Array(source.rawBytes),
    messages: [source.preByteExact ? "Pre-TIA يعيد بايتات الملف التي اختارها المستخدم كما هي، بلا إعادة كتابة أو تعديل." : "Pre-TIA مبني من نص مستورد بالواجهة القديمة؛ أعد استيراد ملف XER من القرص لتأكيد التطابق البايتي."],
    addedTaskIds: [],
    addedRelationshipIds: [],
  };
}

/**
 * يحقن Fragnet علاقات فقط في نسخة من XER الأصلي. لا يدعم هذا المسار المحافظ تقسيم
 * نشاط أصلي لأن ذلك يستلزم إعادة كتابة TASK/TASKPRED موجودين، وهي مخاطرة لا نخفيها.
 */
export function exportPreservedPostXer(schedule: Schedule, event: Fragnet): PreservedXerExportResult {
  const source = schedule.xerSource;
  if (!source?.rawText || !source.rawBytes?.length || !source.sourceEncoding) return blockedPreservedResult(schedule, event, "POST-TIA", ["بايتات ملف XER الأصلي أو بيانات ترميزه غير متاحة في ذاكرة هذه الجلسة. أعد استيراد ملف XER نفسه قبل حقن Post-TIA."]);
  if (event.replacedActivityIds?.length || event.model === "activity-split") {
    return blockedPreservedResult(schedule, event, "POST-TIA", ["تم حجب Post-TIA المحافظ: نموذج Activity Split يبدل أنشطة أو علاقات أصلية، بينما هذه النسخة لا تعيد كتابة صفوف XER الموجودة. استخدم Fragnet علاقات فقط أو راجع الملف يدوياً في P6."]);
  }

  const document = parseXerDocument(source.rawText);
  const taskTables = xerTableBlocks(document, "TASK");
  const predecessorTables = xerTableBlocks(document, "TASKPRED");
  const projectTables = xerTableBlocks(document, "PROJECT");
  const messages: string[] = [];
  if (taskTables.length !== 1 || predecessorTables.length !== 1 || projectTables.length !== 1) {
    return blockedPreservedResult(schedule, event, "POST-TIA", ["يتطلب الحقن المحافظ جدول PROJECT وTASK وTASKPRED واحداً لكل منها. بنية الملف الحالية متعددة أو ناقصة، لذلك لم يُنشأ Post."]);
  }
  const taskTable = taskTables[0];
  const predecessorTable = predecessorTables[0];
  const missingTaskFields = missingFields(taskTable, requiredTaskFields);
  const missingPredecessorFields = missingFields(predecessorTable, requiredPredecessorFields);
  if (missingTaskFields.length || missingPredecessorFields.length) {
    return blockedPreservedResult(schedule, event, "POST-TIA", [`لا يحتوي المصدر حقول الحقن المطلوبة. TASK: ${missingTaskFields.join(", ") || "مكتمل"}; TASKPRED: ${missingPredecessorFields.join(", ") || "مكتمل"}.`]);
  }
  const projectId = source.projectId || projectTables[0].rows[0]?.values.proj_id;
  if (!projectId) return blockedPreservedResult(schedule, event, "POST-TIA", ["لم يُقرأ PROJECT.proj_id؛ لن يُخمن الحقن معرف المشروع."]);

  const sourceTaskIds = taskTable.rows.map((row) => row.values.task_id).filter(Boolean);
  const sourcePredecessorIds = predecessorTable.rows.map((row) => row.values.task_pred_id).filter(Boolean);
  const duplicateTaskIds = duplicateValues(sourceTaskIds);
  const duplicatePredecessorIds = duplicateValues(sourcePredecessorIds);
  if (duplicateTaskIds.length || duplicatePredecessorIds.length) {
    return blockedPreservedResult(schedule, event, "POST-TIA", [`توقّف الحقن لأن المصدر يحوي معرفات مكررة. TASK: ${duplicateTaskIds.join(", ") || "لا يوجد"}; TASKPRED: ${duplicatePredecessorIds.join(", ") || "لا يوجد"}.`]);
  }
  if (!event.activities.length || !event.relationships.length) return blockedPreservedResult(schedule, event, "POST-TIA", ["الحدث يحتاج نشاط Fragnet واحداً وعلاقة واحدة على الأقل قبل إنشاء Post-TIA."]);
  const duplicateEventActivities = duplicateValues(event.activities.map((activity) => activity.id));
  if (duplicateEventActivities.length || event.activities.some((activity) => sourceTaskIds.includes(activity.id))) {
    return blockedPreservedResult(schedule, event, "POST-TIA", ["معرف نشاط Fragnet مكرر أو مطابق لمعرف TASK أصلي؛ عدّل معرفات الحدث قبل الحقن."]);
  }

  const calendarRows = xerTableBlocks(document, "CALENDAR").flatMap((table) => table.rows);
  const calendarById = new Map(calendarRows.map((row) => [row.values.clndr_id, row]));
  const requestedCalendarIds = Array.from(new Set(event.activities.map((activity) => activity.calendarId).filter((id): id is string => Boolean(id))));
  const fallbackCalendarId = source.projectCalendarId && calendarById.has(source.projectCalendarId)
    ? source.projectCalendarId
    : source.taskCalendarIds.length === 1 && calendarById.has(source.taskCalendarIds[0])
      ? source.taskCalendarIds[0]
      : undefined;
  const calendarId = requestedCalendarIds.length === 1 ? requestedCalendarIds[0] : fallbackCalendarId;
  if (requestedCalendarIds.length > 1 || !calendarId || !calendarById.has(calendarId)) {
    return blockedPreservedResult(schedule, event, "POST-TIA", ["يلزم تعيين تقويم Primavera واحد معروف لأنشطة الـ Fragnet. لم يخمن التطبيق تقويماً بين عدة تقاويم أو تعيين مفقود."]);
  }
  const hoursPerDay = positiveNumber(calendarById.get(calendarId)?.values.day_hr_cnt);
  if (!hoursPerDay) return blockedPreservedResult(schedule, event, "POST-TIA", ["CALENDAR.day_hr_cnt غير مقروء للتقويم المختار؛ أوقف الحقن بدل تحويل مدة الحدث بساعات مفترضة."]);
  const wbsIds = Array.from(new Set(event.activities.map((activity) => activity.wbsId).filter((id): id is string => Boolean(id))));
  if (wbsIds.length !== 1) return blockedPreservedResult(schedule, event, "POST-TIA", ["يلزم WBS واحد صريح لأنشطة الـ Fragnet في هذا الإصدار المحافظ؛ راجع الأنشطة المختارة."]);
  const wbsId = wbsIds[0];
  const sourceWbsIds = new Set((xerTableBlocks(document, "PROJWBS").flatMap((table) => table.rows)).map((row) => row.values.wbs_id).filter(Boolean));
  if (sourceWbsIds.size && !sourceWbsIds.has(wbsId)) return blockedPreservedResult(schedule, event, "POST-TIA", [`WBS ${wbsId} غير موجود في PROJWBS المصدر؛ لن يُنشأ Post بتعيين WBS متخيل.`]);

  const generatedTaskIds = nextNumericIds(sourceTaskIds, event.activities.length, "TASK.task_id");
  const generatedRelationshipIds = nextNumericIds(sourcePredecessorIds, event.relationships.length, "TASKPRED.task_pred_id");
  if (generatedTaskIds.error || generatedRelationshipIds.error || !generatedTaskIds.values || !generatedRelationshipIds.values) {
    return blockedPreservedResult(schedule, event, "POST-TIA", [generatedTaskIds.error ?? generatedRelationshipIds.error ?? "تعذّر إنشاء معرفات XER داخلية."]);
  }
  const taskIdByLogicalId = new Map(sourceTaskIds.map((id) => [id, id]));
  event.activities.forEach((activity, index) => taskIdByLogicalId.set(activity.id, generatedTaskIds.values![index]));
  const unresolvedEndpoints = event.relationships.filter((relationship) => !taskIdByLogicalId.has(relationship.predecessorId) || !taskIdByLogicalId.has(relationship.successorId));
  if (unresolvedEndpoints.length) return blockedPreservedResult(schedule, event, "POST-TIA", ["توجد علاقة Fragnet تشير إلى نشاط غير موجود في المصدر أو الحدث؛ صحح نقاط الربط قبل الحقن."]);
  const replacements = Array.from(new Set(event.replacedRelationshipIds ?? []));
  const predecessorRowsById = new Map(predecessorTable.rows.map((row) => [row.values.task_pred_id, row]));
  const missingReplacements = replacements.filter((id) => !predecessorRowsById.has(id));
  if (missingReplacements.length) return blockedPreservedResult(schedule, event, "POST-TIA", [`العلاقات المطلوب استبدالها غير موجودة في TASKPRED المصدر: ${missingReplacements.join(", ")}.`]);

  const patch = {
    removeRows: replacements.map((id) => predecessorRowsById.get(id) as XerDocumentRow),
    appendRows: [
      { table: taskTable, rows: event.activities.map((activity, index) => dateFreeTaskCells(taskTable, activity, generatedTaskIds.values![index], projectId, calendarId, wbsId, hoursPerDay)) },
      { table: predecessorTable, rows: event.relationships.map((relationship, index) => predecessorCells(predecessorTable, relationship, generatedRelationshipIds.values![index], taskIdByLogicalId, projectId, hoursPerDay)) },
    ],
  };
  let bytes: Uint8Array;
  try {
    bytes = applyConservativeXerBytePatch(document, {
      rawBytes: source.rawBytes,
      sourceEncoding: source.sourceEncoding,
      sourceByteOffset: source.sourceByteOffset ?? 0,
    }, patch);
  } catch (error) {
    return blockedPreservedResult(schedule, event, "POST-TIA", [error instanceof Error ? error.message : "تعذر تطبيق حقن بايت آمن على ملف XER المصدر."]);
  }
  const expectedActivityCount = sourceTaskIds.length + event.activities.length;
  const expectedRelationshipCount = sourcePredecessorIds.length - replacements.length + event.relationships.length;
  let localRoundTrip: XerRoundTripCheck | undefined;
  try {
    const reimported = importXerBytes(bytes, preservedFileName(schedule, event, "POST-TIA"));
    const roundTripMessages: string[] = [];
    if (reimported.summary.activitiesRead !== expectedActivityCount) roundTripMessages.push(`تطابق الأنشطة المحلي فشل: المتوقع ${expectedActivityCount} والمقروء ${reimported.summary.activitiesRead}.`);
    if (reimported.summary.relationshipsRead !== expectedRelationshipCount) roundTripMessages.push(`تطابق العلاقات المحلي فشل: المتوقع ${expectedRelationshipCount} والمقروء ${reimported.summary.relationshipsRead}.`);
    localRoundTrip = { state: roundTripMessages.length ? "blocked" : "review", activityCount: reimported.summary.activitiesRead, relationshipCount: reimported.summary.relationshipsRead, messages: roundTripMessages.length ? roundTripMessages : ["نجح فحص البنية والأعداد داخل TIA Studio. ما زال يلزم استيراد Post في Primavera P6 وإجراء Schedule/F9 قبل أي اعتماد."] };
  } catch (error) {
    localRoundTrip = { state: "blocked", activityCount: 0, relationshipCount: 0, messages: [error instanceof Error ? `فشل الاستيراد المحلي لنسخة Post: ${error.message}` : "فشل الاستيراد المحلي لنسخة Post."] };
  }
  if (localRoundTrip.state === "blocked") return blockedPreservedResult(schedule, event, "POST-TIA", localRoundTrip.messages);
  messages.push("تم تغيير TASKPRED المحددة للإزالة وإضافة صفوف TASK/TASKPRED فقط؛ جميع البايتات الأصلية خارج هذه المواضع، بما فيها CALENDAR وRSRC وTASKRSRC والقيود وUDF والخطوط الأساسية، نُسخت مباشرةً بلا إعادة ترميز.");
  messages.push("حقول التاريخ والـ Float للنشاط الجديد تُركت فارغة عمداً كي يحسبها Primavera من تقويمه الأصلي؛ لا يمثل الملف شهادة تطابق قبل F9 ومقارنة النتائج.");
  return { state: "ready", fileName: preservedFileName(schedule, event, "POST-TIA"), bytes, messages, addedTaskIds: generatedTaskIds.values, addedRelationshipIds: generatedRelationshipIds.values, calendarAssignmentId: calendarId, localRoundTrip };
}

async function sha256(bytes: Uint8Array) {
  if (!globalThis.crypto?.subtle) return undefined;
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function p6ReimportChecklist(
  schedule: Schedule,
  event: Fragnet,
  pre: PreservedXerExportResult,
  post: PreservedXerExportResult,
  calendarMatch: PrimaveraCalendarMatchAssessment,
) {
  const safe = (value: string | number | undefined) => value === undefined || value === "" ? "غير متاح / Not available" : String(value);
  const postAvailability = post.state === "ready" ? "متاح للمراجعة / Available for review" : "محجوب — راجع manifest.json / Blocked — see manifest.json";
  return [
    "# ورقة تحقق Primavera P6: إعادة الاستيراد ثم Schedule/F9",
    "",
    "> هذه ورقة تسجيل فنية قصيرة. لا تثبت وحدها صحة Post، ولا تنسب مسؤولية أو EOT أو entitlement، ولا تعيد حساب Primavera داخل TIA Studio.",
    "",
    `- **الحدث / Event:** ${event.id} — ${event.title}`,
    `- **ملف المصدر / Source:** ${safe(schedule.xerSource?.originalFileName)}`,
    `- **Pre:** ${pre.fileName}`,
    `- **Post:** ${post.fileName} (${postAvailability})`,
    "",
    "## قبل فتح Primavera / Before P6",
    "",
    "1. أنشئ نسخة غير إنتاجية من مشروع P6 أو قاعدة اختبار. لا تستورد في برنامج المشروع المعتمد مباشرة.",
    "2. سجّل نسخة Primavera وإعدادات Schedule، وخذ لقطة قبل الاستيراد. احتفظ بـPre وPost داخل هذه الحزمة كما هما.",
    "3. لا تبدأ الاختبار إذا كانت حالة Post محجوبة. راجع manifest.json، وصحح سبب الحجب في المصدر الأصلي ثم أعد تصدير الحزمة.",
    "",
    "## خطوات التحقق / Reviewer steps",
    "",
    "1. استورد ملف Pre في نسخة الاختبار. راجع Import Log، اسم المشروع، WBS، عدد الأنشطة، وعدد العلاقات مقابل المصدر.",
    "2. افتح Calendar Details في P6. راجع تقويم النشاط وتقويم المشروع ونمط الأسبوع والاستثناءات/الشفتات. لا تستنتج شيئاً من مؤشرات TIA Studio وحدها.",
    "3. إذا كان Post متاحاً، استورده في نسخة اختبار منفصلة. راجع Import Log ثم ابحث عن نشاط/علاقات الـFragment فقط.",
    "4. نفّذ Schedule/F9 بإعدادات P6 نفسها. سجّل Data Date وتاريخ الإكمال والمسار الحرج وTotal Float بعد F9.",
    "5. أرفق Import Log وSchedule/F9 report أو لقطاته مع ملف القضية خارج هذه الحزمة عند الاقتضاء. لا تدخل ملفات المشروع في TIA Studio لمجرد التوثيق.",
    "",
    "## سجل تحقق بعد Schedule/F9",
    "",
    "| بند المراجعة | مرجع الحزمة المحلي | قيمة P6 بعد الاستيراد وSchedule/F9 | نتيجة المراجع |",
    "|---|---|---|---|",
    `| حالة Post | ${postAvailability} | اكتب النتيجة | Pass / Review / Block |`,
    `| تقويم النشاط الجديد | ${safe(post.calendarAssignmentId)} | اكتب CALENDAR المستخدم | Pass / Review / Block |`,
    `| ساعات اليوم / day_hr_cnt | ${safe(calendarMatch.hoursPerDay.source)} | اكتب القيمة في P6 | Pass / Review / Block |`,
    `| Data Date | ${safe(calendarMatch.dataDate.source)} | اكتب القيمة بعد F9 | Pass / Review / Block |`,
    `| clndr_data / نمط الأسبوع والاستثناءات | ${calendarMatch.encodedCalendarData.state === "present" ? `${calendarMatch.encodedCalendarData.calendarsWithEncodedData} تقويم مشفر؛ ${calendarMatch.encodedCalendarData.plainDateMarkerCount} علامة تاريخ غير مفسرة` : "غير ظاهر"} | راجع Calendar Details في P6 | Pass / Review / Block |`,
    `| عدد الأنشطة | ${safe(post.localRoundTrip?.activityCount)} | اكتب العدد بعد الاستيراد | Pass / Review / Block |`,
    `| عدد العلاقات | ${safe(post.localRoundTrip?.relationshipCount)} | اكتب العدد بعد الاستيراد | Pass / Review / Block |`,
    "| تاريخ إكمال المشروع | غير محسوب من ملف XER المحافظ | اكتب التاريخ بعد F9 | Pass / Review / Block |",
    "| المسار الحرج وTotal Float | يتطلب مقارنة مستقلة | اكتب النتيجة أو مرجع التقرير | Pass / Review / Block |",
    "",
    "## قرار فني فقط / Technical outcome only",
    "",
    "| النتيجة | متى تستخدمها | الإجراء التالي |",
    "|---|---|---|",
    "| Pass فني | Pre/Post يستوردان، وF9 مكتمل، والأعداد وإعدادات التقويم موثقة | احفظ الإثباتات وانتقل للمراجعة المهنية؛ لا يعني ذلك حكم EOT أو مسؤولية |",
    "| Review | الاستيراد تم لكن يوجد فرق تقويم/تاريخ/Float أو اختيار Schedule غير موثق | توقف عن الاعتماد، وثّق الفرق، وراجعه داخل P6 |",
    "| Block | Post محجوب أو Import Log يظهر خطأ أو لم يُنفذ F9 | لا تستخدم النتائج؛ صحح المصدر أو منطق الحدث ثم أعد تصدير الحزمة |",
    "",
    "## حدود لازمة",
    "",
    "- احتفظت الحزمة بجداول المصدر كما هي، مع حذف TASKPRED المعلن وإضافة TASK/TASKPRED للـFragment فقط عند جاهزية Post.",
    "- لا يفك TIA Studio `clndr_data` أو وراثة التقويم أو نمط الأسبوع أو الاستثناءات والشفتات؛ علامات التاريخ الظاهرة مؤشرات فقط. فرق التقويم أو Data Date يستلزم مراجعة P6.",
    "- إذا كان Post محجوباً، لا تحاول إنشاء ملف بديل من هذه الحزمة؛ صحح سبب الحجب أولاً ثم أعد التصدير من المصدر الأصلي.",
    "",
  ].join("\n");
}

function p6ReconciliationArtifact(schedule: Schedule, event: Fragnet, post: PreservedXerExportResult) {
  if (post.state !== "ready" || !post.bytes) {
    return {
      fileName: "P6-RECONCILIATION-STATUS.json",
      content: `${JSON.stringify({
        purpose: "p6-reconciliation-status",
        eventId: event.id,
        state: "blocked",
        scopeNotice: "لم يتولد Post محافظ لهذا الحدث؛ لا توجد بيانات للمقارنة في P6. راجع manifest.json ودليل Schedule/F9.",
        messages: post.messages,
      }, null, 2)}\n`,
    };
  }
  try {
    const reimported = importXerBytes(post.bytes, post.fileName);
    const manifest = buildP6ReconciliationManifest({
      schedule: reimported.schedule,
      cpm: runCPM(reimported.schedule),
      xerSummary: reimported.summary,
    });
    return { fileName: "P6-LOCAL-RECONCILIATION.json", content: serializeP6ReconciliationManifest(manifest) };
  } catch (error) {
    return {
      fileName: "P6-RECONCILIATION-STATUS.json",
      content: `${JSON.stringify({
        purpose: "p6-reconciliation-status",
        eventId: event.id,
        state: "review-required",
        scopeNotice: "تعذر إنشاء أثر المطابقة المحلي؛ لا يعني ذلك قبول أو رفض P6. أكمل إعادة الاستيراد وSchedule/F9 يدوياً.",
        message: error instanceof Error ? error.message : "تعذر إنشاء أثر المطابقة المحلي.",
      }, null, 2)}\n`,
    };
  }
}

/** يبني ZIP داخل المتصفح فقط؛ الأحداث المحجوبة تحصل على manifest واضح من دون Post مضلل. */
export async function buildPreservedEventPackageZip(schedule: Schedule, events: Fragnet[]): Promise<PreservedEventPackageResult> {
  if (!events.length) throw new Error("اختر حدثاً واحداً على الأقل قبل إنشاء Event Package.");
  const zip = new JSZip();
  const root = `${safeFilePart(schedule.name, "TIA-Schedule")}--EVENT-PACKAGE`;
  const calendarMatch = assessPrimaveraCalendarMatch(schedule);
  const sourceHash = schedule.xerSource?.rawBytes ? await sha256(schedule.xerSource.rawBytes) : undefined;
  const statuses: PreservedEventPackageResult["events"] = [];

  for (const event of events) {
    const pre = exportPreservedPreXer(schedule, event);
    const post = exportPreservedPostXer(schedule, event);
    const eventFolder = `${root}/events/${safeFilePart(event.id, "EVENT")}`;
    if (pre.state === "ready" && pre.bytes) zip.file(`${eventFolder}/${pre.fileName}`, pre.bytes);
    if (post.state === "ready" && post.bytes) zip.file(`${eventFolder}/${post.fileName}`, post.bytes);
    zip.file(`${eventFolder}/P6-REIMPORT-SCHEDULE-F9-CHECKLIST.md`, p6ReimportChecklist(schedule, event, pre, post, calendarMatch));
    const reconciliationArtifact = p6ReconciliationArtifact(schedule, event, post);
    zip.file(`${eventFolder}/${reconciliationArtifact.fileName}`, reconciliationArtifact.content);
    const manifest = {
      format: "TIA Studio Preserved XER Event Package v1",
      sourceFileName: schedule.xerSource?.originalFileName,
      sourceSha256: sourceHash,
      event: { id: event.id, title: event.title, model: event.model ?? "relationship-fragnet" },
      preservation: { sourceEncoding: schedule.xerSource?.sourceEncoding, preByteExact: schedule.xerSource?.preByteExact ?? false, sourceByteLength: schedule.xerSource?.sourceByteLength, tablesDeclaredInSource: schedule.xerSource?.tableNames ?? [], unchangedBytes: "All original source bytes remain unchanged except listed TASKPRED removals and ASCII-only added TASK/TASKPRED rows." },
      calendar: { assignmentForNewActivities: post.calendarAssignmentId, assessment: calendarMatch },
      pre: { state: pre.state, fileName: pre.fileName, messages: pre.messages },
      post: { state: post.state, fileName: post.fileName, addedActivityCodes: event.activities.map((activity) => activity.id), addedRelationshipLogicalIds: event.relationships.map((relationship) => relationship.id), addedTaskIds: post.addedTaskIds, addedRelationshipIds: post.addedRelationshipIds, localRoundTrip: post.localRoundTrip, messages: post.messages },
      limitations: ["الحزمة محلية ولا ترسل XER إلى خادم أو خدمة خارجية.", "لا يعني الفحص المحلي تطابق P6؛ افتح Post في نسخة منفصلة من Primavera P6 ثم Schedule/F9 وقارن التواريخ والـ Float والأعداد.", "Activity Split محجوب من هذا المسار المحافظ حتى يتوفر مسار إعادة كتابة متحكم فيه ومتحقق منه."],
    };
    zip.file(`${eventFolder}/manifest.json`, JSON.stringify(manifest, null, 2));
    statuses.push({ eventId: event.id, state: post.state, messages: post.messages });
  }
  zip.file(`${root}/package-manifest.json`, JSON.stringify({ format: "TIA Studio Preserved XER Event Package v1", sourceFileName: schedule.xerSource?.originalFileName, sourceSha256: sourceHash, calendarMatch, events: statuses }, null, 2));
  return {
    blob: await zip.generateAsync({ type: "blob" }),
    fileName: `${safeFilePart(schedule.name, "TIA-Schedule")}--EVENT-PACKAGE.zip`,
    events: statuses,
    messages: statuses.some((item) => item.state === "blocked") ? ["تم إنشاء الحزمة مع manifests للأحداث المحجوبة؛ لم يُضف Post غير آمن لهذه الأحداث."] : ["تم إنشاء حزمة محلية لكل الأحداث. راجع manifests ثم تحقق داخل Primavera P6."],
  };
}
