import { runCPM, type RelationshipType, type Schedule } from "./cpm";
import type { XerImportSummary } from "./xer";

export type QualitySeverity = "pass" | "warning" | "blocker";
export type ReadinessState = "ready" | "review" | "blocked";

export type ScheduleQualityRule = {
  id: string;
  title: string;
  severity: QualitySeverity;
  detail: string;
  action: string;
  affectedCount?: number;
};

export type ScheduleQualityAssessment = {
  scheduleFingerprint: string;
  generatedAt: string;
  analysisReadiness: ReadinessState;
  exportReadiness: ReadinessState;
  summary: { passed: number; warnings: number; blockers: number };
  rules: ScheduleQualityRule[];
};

export type QualityLedgerEntry = Pick<ScheduleQualityAssessment, "scheduleFingerprint" | "generatedAt" | "analysisReadiness" | "exportReadiness" | "summary"> & {
  projectName: string;
};

const validRelationshipTypes: RelationshipType[] = ["FS", "SS", "FF", "SF"];

function fingerprint(schedule: Schedule) {
  const raw = [schedule.id, schedule.startDate, schedule.dataDate ?? "", schedule.activities.map((activity) => `${activity.id}:${activity.duration}:${activity.wbsId ?? activity.wbs ?? ""}`).join("|"), schedule.relationships.map((relationship) => `${relationship.predecessorId}>${relationship.successorId}:${relationship.type}:${relationship.lag ?? 0}`).join("|")].join("#");
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `SQ-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function rule(id: string, title: string, severity: QualitySeverity, detail: string, action: string, affectedCount?: number): ScheduleQualityRule {
  return { id, title, severity, detail, action, affectedCount };
}

function readiness(rules: ScheduleQualityRule[]): ReadinessState {
  if (rules.some((item) => item.severity === "blocker")) return "blocked";
  if (rules.some((item) => item.severity === "warning")) return "review";
  return "ready";
}

/**
 * بوابة مراجعة فنية قابلة للتفسير مستلهمة من مبادئ جودة الجدول المتاحة علناً.
 * لا تمنح اعتماداً تعاقدياً ولا تحسم الاستحقاق أو المسؤولية أو قابلية الاستيراد في كل نسخة من P6.
 */
export function assessScheduleQuality(schedule: Schedule, xerSummary?: XerImportSummary | null): ScheduleQualityAssessment {
  const rules: ScheduleQualityRule[] = [];
  const activities = schedule.activities ?? [];
  const activitiesById = new Map<string, number>();
  activities.forEach((activity) => activitiesById.set(activity.id, (activitiesById.get(activity.id) ?? 0) + 1));
  const identifiers = new Set(activities.map((activity) => activity.id));

  rules.push(activities.length
    ? rule("SQ-001", "وجود أنشطة قابلة للحساب", "pass", `تم العثور على ${activities.length} نشاطاً ضمن الشبكة الحالية.`, "استمر إلى مراجعة العلاقات والتقويم.")
    : rule("SQ-001", "وجود أنشطة قابلة للحساب", "blocker", "لا توجد أنشطة يمكن لمحرك CPM حسابها.", "استورد برنامجاً يحتوي على صف TASK/أنشطة صحيحة قبل بدء TIA."));

  const duplicateActivities = Array.from(activitiesById.values()).filter((count) => count > 1).length;
  rules.push(duplicateActivities
    ? rule("SQ-002", "معرّفات النشاط الفريدة", "blocker", `تم العثور على ${duplicateActivities} معرّف نشاط مكرر.`, "صحّح Activity ID المكرر في البرنامج المصدر ثم أعد الاستيراد.", duplicateActivities)
    : rule("SQ-002", "معرّفات النشاط الفريدة", "pass", "لا توجد معرّفات نشاط مكررة في الشبكة الحالية.", "لا يلزم إجراء."));

  const invalidDuration = activities.filter((activity) => !Number.isFinite(activity.duration) || activity.duration < 0).length;
  rules.push(invalidDuration
    ? rule("SQ-003", "مدد الأنشطة الصالحة", "blocker", `توجد ${invalidDuration} مدة غير رقمية أو سالبة.`, "صحّح Original/Remaining Duration إلى أيام عمل غير سالبة.", invalidDuration)
    : rule("SQ-003", "مدد الأنشطة الصالحة", "pass", "كل مدد الأنشطة أرقام غير سالبة قابلة للحساب.", "لا يلزم إجراء."));

  const invalidProgress = activities.filter((activity) => activity.percentComplete !== undefined && (!Number.isFinite(activity.percentComplete) || activity.percentComplete < 0 || activity.percentComplete > 100)).length;
  rules.push(invalidProgress
    ? rule("SQ-004", "نسب الإنجاز المنطقية", "blocker", `توجد ${invalidProgress} نسبة إنجاز خارج نطاق 0–100%.`, "صحّح نسبة الإنجاز في الملف المصدر قبل اعتماد التحديث.", invalidProgress)
    : rule("SQ-004", "نسب الإنجاز المنطقية", "pass", "نسب الإنجاز المقروءة تقع ضمن النطاق المسموح.", "لا يلزم إجراء."));

  const brokenRelationships = schedule.relationships.filter((relationship) => !identifiers.has(relationship.predecessorId) || !identifiers.has(relationship.successorId));
  rules.push(brokenRelationships.length
    ? rule("SQ-005", "أطراف العلاقات موجودة", "blocker", `توجد ${brokenRelationships.length} علاقة تشير إلى نشاط غير موجود.`, "أصلح TASKPRED أو معرّفات الأنشطة، ثم أعد القراءة.", brokenRelationships.length)
    : rule("SQ-005", "أطراف العلاقات موجودة", "pass", "كل العلاقات تشير إلى أنشطة موجودة.", "لا يلزم إجراء."));

  const selfRelationships = schedule.relationships.filter((relationship) => relationship.predecessorId === relationship.successorId).length;
  rules.push(selfRelationships
    ? rule("SQ-006", "منع العلاقة الذاتية", "blocker", `توجد ${selfRelationships} علاقة تربط النشاط بنفسه.`, "احذف أو صحح العلاقة الذاتية في البرنامج المصدر.", selfRelationships)
    : rule("SQ-006", "منع العلاقة الذاتية", "pass", "لا توجد علاقات ذاتية في الشبكة.", "لا يلزم إجراء."));

  const unknownRelationshipTypes = schedule.relationships.filter((relationship) => !validRelationshipTypes.includes(relationship.type)).length;
  rules.push(unknownRelationshipTypes
    ? rule("SQ-007", "نوع العلاقة المنطقية", "blocker", `توجد ${unknownRelationshipTypes} علاقة بنوع غير مدعوم.`, "استخدم FS أو SS أو FF أو SF وحدد الـLag بوضوح.", unknownRelationshipTypes)
    : rule("SQ-007", "نوع العلاقة المنطقية", "pass", "أنواع العلاقات المحفوظة مدعومة في المحرك.", "لا يلزم إجراء."));

  try {
    runCPM(schedule);
    rules.push(rule("SQ-008", "قابلية حساب شبكة CPM", "pass", "اكتمل الفحص الطوبولوجي دون حلقة منطقية ظاهرة.", "استمر إلى مراجعة الافتراضات والتقويم."));
  } catch (error) {
    rules.push(rule("SQ-008", "قابلية حساب شبكة CPM", "blocker", error instanceof Error ? error.message : "تعذر حساب شبكة CPM.", "راجع العلاقات المتبادلة والحلقات قبل التحليل."));
  }

  const workingDays = schedule.calendar?.workingWeekdays ?? [];
  rules.push(workingDays.length
    ? rule("SQ-009", "تقويم العمل", "pass", `التقويم «${schedule.calendar?.name ?? "غير مسمى"}» يحدد ${workingDays.length} أيام عمل أسبوعياً.`, "راجع أيام العمل والعطل لأنها تؤثر في التاريخ لا في المدة فقط.")
    : rule("SQ-009", "تقويم العمل", "blocker", "لا توجد أيام عمل معرفة في التقويم.", "عرّف تقويم المشروع قبل قبول النتائج أو التصدير."));

  rules.push(schedule.dataDate
    ? rule("SQ-010", "تاريخ البيانات (Data Date)", "pass", `تاريخ البيانات المحدد هو ${schedule.dataDate}.`, "راجع أنه يطابق تاريخ تحديث البرنامج محل التحليل.")
    : rule("SQ-010", "تاريخ البيانات (Data Date)", "warning", "لا يوجد تاريخ بيانات محدد؛ يصعب تتبع حالة تحديث برنامج قيد التنفيذ.", "أدخل Data Date في P6 أو سجله يدوياً قبل تحليل تحديث."));

  const activitiesWithoutWbs = activities.filter((activity) => !activity.wbs && !activity.wbsId).length;
  rules.push(activitiesWithoutWbs
    ? rule("SQ-011", "ربط WBS", "warning", `${activitiesWithoutWbs} نشاطاً بلا WBS مقروء أو مرتبط.`, "راجع هيكل تقسيم العمل لتحسين قابلية التتبع والتقرير.", activitiesWithoutWbs)
    : rule("SQ-011", "ربط WBS", "pass", "كل الأنشطة مرتبطة بـWBS أو WBS ID.", "لا يلزم إجراء."));

  const longActivities = activities.filter((activity) => activity.duration > 20).length;
  rules.push(longActivities
    ? rule("SQ-012", "الأنشطة طويلة المدة", "warning", `توجد ${longActivities} نشاطاً أطول من 20 يوم عمل؛ هذا مؤشر مراجعة قابل للضبط وليس رفضاً تلقائياً.`, "تحقق من إمكانية تفصيل النشاط مع الحفاظ على منطق البرنامج.", longActivities)
    : rule("SQ-012", "الأنشطة طويلة المدة", "pass", "لا يوجد نشاط يتجاوز مؤشر المراجعة الافتراضي 20 يوم عمل.", "يمكن ضبط المؤشر حسب العقد أو المشروع."));

  if (xerSummary) {
    const tables = new Set(xerSummary.tablesFound.map((table) => table.toUpperCase()));
    rules.push(tables.has("TASK") && tables.has("TASKPRED")
      ? rule("SQ-013", "جداول XER الأساسية", "pass", `قُرئت TASK وTASKPRED من ملف XER (${xerSummary.activitiesRead} نشاطاً و${xerSummary.relationshipsRead} علاقة).`, "راجع سجل التحذيرات المقروءة قبل الاعتماد.")
      : rule("SQ-013", "جداول XER الأساسية", "blocker", "لم يثبت وجود TASK وTASKPRED معاً في ملخص XER.", "استخدم تصديراً يحتوي بيانات المشروع والعلاقات، وليس ملفاً جزئياً."));
    rules.push(xerSummary.calendarName
      ? rule("SQ-014", "سجل تقويم XER", "pass", `تمت قراءة اسم التقويم: ${xerSummary.calendarName}.`, "راجع نمط ساعات وأيام التقويم يدوياً لأن ترميز P6 لا يكتمل استعادته.")
      : rule("SQ-014", "سجل تقويم XER", "warning", "لم يُقرأ سجل تقويم واضح من XER.", "اختر تقويم العمل يدوياً قبل حساب تاريخ الإكمال."));
  }

  const summary = rules.reduce((current, item) => {
    if (item.severity === "pass") current.passed += 1;
    if (item.severity === "warning") current.warnings += 1;
    if (item.severity === "blocker") current.blockers += 1;
    return current;
  }, { passed: 0, warnings: 0, blockers: 0 });
  const analysisReadiness = readiness(rules);
  const exportReadiness = summary.blockers ? "blocked" : summary.warnings ? "review" : "review";

  return { scheduleFingerprint: fingerprint(schedule), generatedAt: new Date().toISOString(), analysisReadiness, exportReadiness, summary, rules };
}

export function buildQualityLedgerEntry(schedule: Schedule, assessment: ScheduleQualityAssessment): QualityLedgerEntry {
  return { projectName: schedule.name, scheduleFingerprint: assessment.scheduleFingerprint, generatedAt: assessment.generatedAt, analysisReadiness: assessment.analysisReadiness, exportReadiness: assessment.exportReadiness, summary: assessment.summary };
}
