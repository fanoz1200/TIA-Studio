import type { Schedule } from "./cpm";
import type { XerImportSummary } from "./xer";

export type GateStatus = "ready" | "review" | "missing";

export type P6ReadinessCheck = {
  key: "activities" | "relationships" | "calendar" | "dataDate" | "warnings";
  title: string;
  detail: string;
  status: GateStatus;
};

export type P6ReadinessGate = {
  checks: P6ReadinessCheck[];
  readyCount: number;
  requiresAcknowledgement: boolean;
};

/**
 * هذه البوابة لا تحكم بصلاحية ملف P6 قانونياً أو فنياً؛ بل تجعل الفجوات
 * التي قد تغيّر نتيجة TIA ظاهرة للمحلل قبل بناء نسخة Pre-TIA.
 */
export function buildP6ReadinessGate(schedule: Schedule, summary: XerImportSummary | null): P6ReadinessGate {
  const activities = schedule.activities.length;
  const relationships = schedule.relationships.length;
  const warnings = summary?.warnings ?? schedule.importNotes ?? [];
  const checks: P6ReadinessCheck[] = [
    {
      key: "activities",
      title: "الأنشطة المقروءة",
      detail: activities ? `${activities} نشاطاً في نسخة التحليل.` : "لم تُقرأ أنشطة قابلة للحساب.",
      status: activities ? "ready" : "missing",
    },
    {
      key: "relationships",
      title: "العلاقات المنطقية",
      detail: relationships ? `${relationships} علاقة منطقية مقروءة.` : "لا توجد علاقات؛ لا يمكن إثبات شبكة CPM.",
      status: relationships ? "ready" : "missing",
    },
    {
      key: "calendar",
      title: "تقويم المشروع",
      detail: schedule.calendar?.workingWeekdays.length ? `التقويم الحالي: ${schedule.calendar.name}.` : "أيام العمل غير محددة.",
      status: schedule.calendar?.workingWeekdays.length ? (summary?.calendarName ? "review" : "ready") : "missing",
    },
    {
      key: "dataDate",
      title: "تاريخ البيانات",
      detail: schedule.dataDate ? `Data Date: ${schedule.dataDate}.` : "لم يُقرأ Data Date؛ أدخله أو وثّق سبب استخدام Baseline.",
      status: schedule.dataDate ? "ready" : "review",
    },
    {
      key: "warnings",
      title: "فجوات الاستيراد",
      detail: warnings.length ? `${warnings.length} ملاحظة تحتاج مراجعة.` : "لا توجد ملاحظات استيراد مسجلة.",
      status: warnings.length ? "review" : "ready",
    },
  ];
  return {
    checks,
    readyCount: checks.filter(check => check.status === "ready").length,
    requiresAcknowledgement: checks.some(check => check.status !== "ready"),
  };
}

export type SplitPreview = {
  predecessor: string;
  affectedActivity: string;
  event: string;
  successor: string;
  sourceRelationshipId: string;
};

/**
 * معاينة تشغيلية فقط. يظل ملف المصدر دون تعديل، ويصبح التقسيم شبكة Fragnet
 * مستقلة لا تُطبق إلا بعد أن يعتمدها المستخدم في خطوة النمذجة.
 */
export function buildSplitPreview(schedule: Schedule, relationshipId: string, eventId: string): SplitPreview | null {
  const relationship = schedule.relationships.find(item => item.id === relationshipId);
  if (!relationship) return null;
  const predecessor = schedule.activities.find(item => item.id === relationship.predecessorId);
  const successor = schedule.activities.find(item => item.id === relationship.successorId);
  return {
    predecessor: predecessor?.name || relationship.predecessorId,
    affectedActivity: successor?.name || relationship.successorId,
    event: eventId,
    successor: successor?.name || relationship.successorId,
    sourceRelationshipId: relationship.id,
  };
}
