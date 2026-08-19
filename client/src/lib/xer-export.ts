/**
 * مُصدّر XER تبادلي محدود. يكتب الجداول التي يستطيع TIA Studio استعادتها
 * (PROJECT / CALENDAR / PROJWBS / TASK / TASKPRED) ولا يدّعي تكافؤ نسخة P6 كاملة.
 */
import { addWorkingDays, runCPM, type Schedule } from "./cpm";
import { importXerSchedule } from "./xer";

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
      "لا يتضمن نمط تقويم P6 المشفر أو الموارد أو التكاليف أو القيود أو الخطوط الأساسية أو الحقول المخصصة أو الحقول الأمنية.",
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
