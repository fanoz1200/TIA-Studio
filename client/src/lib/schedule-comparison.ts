import { runCPM, type Activity, type Schedule } from "@/lib/cpm";

export type ActivityVarianceStatus = "unchanged" | "changed" | "added" | "removed";

export type ActivityVariance = {
  id: string;
  name: string;
  status: ActivityVarianceStatus;
  durationDelta: number | null;
  baselineDuration: number | null;
  updateDuration: number | null;
  notes: string[];
};

export type ScheduleComparison = {
  baseline: { name: string; activityCount: number; completionDate: string; projectDuration: number };
  update: { name: string; activityCount: number; completionDate: string; projectDuration: number };
  completionDeltaDays: number;
  activityVariances: ActivityVariance[];
  summary: { added: number; removed: number; changed: number; unchanged: number; warnings: string[] };
};

function sameItems<T>(left: T[] = [], right: T[] = []) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function describeActivityChange(baseline: Activity, update: Activity) {
  const notes: string[] = [];
  if (baseline.name !== update.name) notes.push("تغيّر الاسم");
  if (baseline.duration !== update.duration) notes.push(`المدة ${baseline.duration} ← ${update.duration} يوم`);
  if ((baseline.wbs ?? "") !== (update.wbs ?? "")) notes.push("تغيّر WBS");
  if ((baseline.owner ?? "") !== (update.owner ?? "")) notes.push("تغيّرت الجهة المسؤولة");
  if ((baseline.plannedStart ?? null) !== (update.plannedStart ?? null)) notes.push("تغيّر البدء المخطط");
  return notes;
}

/** Compares two user-supplied updates locally; it does not infer contractual entitlement. */
export function compareScheduleUpdates(baseline: Schedule, update: Schedule): ScheduleComparison {
  const baselineCpm = runCPM(baseline);
  const updateCpm = runCPM(update);
  const updateById = new Map(update.activities.map((activity) => [activity.id, activity]));
  const baselineById = new Map(baseline.activities.map((activity) => [activity.id, activity]));
  const activityVariances: ActivityVariance[] = [];

  for (const activity of baseline.activities) {
    const next = updateById.get(activity.id);
    if (!next) {
      activityVariances.push({ id: activity.id, name: activity.name, status: "removed", durationDelta: null, baselineDuration: activity.duration, updateDuration: null, notes: ["النشاط غير موجود في التحديث"] });
      continue;
    }
    const notes = describeActivityChange(activity, next);
    activityVariances.push({ id: activity.id, name: next.name, status: notes.length ? "changed" : "unchanged", durationDelta: next.duration - activity.duration, baselineDuration: activity.duration, updateDuration: next.duration, notes });
  }
  for (const activity of update.activities) {
    if (!baselineById.has(activity.id)) activityVariances.push({ id: activity.id, name: activity.name, status: "added", durationDelta: null, baselineDuration: null, updateDuration: activity.duration, notes: ["نشاط جديد في التحديث"] });
  }

  const warnings: string[] = [];
  if (baseline.startDate !== update.startDate) warnings.push("تاريخ بدء النسختين مختلف؛ قارن فرق المدة مع مراجعة تاريخ البيانات.");
  if (!sameItems(baseline.calendar?.workingWeekdays, update.calendar?.workingWeekdays)) warnings.push("أيام العمل في التقويم مختلفة بين النسختين.");
  if (!sameItems(baseline.calendar?.holidays, update.calendar?.holidays)) warnings.push("سجل العطل مختلف بين النسختين.");
  if (!activityVariances.some((item) => item.status !== "unchanged")) warnings.push("لم يظهر فرق على مستوى خصائص الأنشطة المقروءة؛ راجع العلاقات والمنطق أيضاً.");

  const count = (status: ActivityVarianceStatus) => activityVariances.filter((item) => item.status === status).length;
  return {
    baseline: { name: baseline.name, activityCount: baseline.activities.length, completionDate: baselineCpm.completionDate, projectDuration: baselineCpm.projectDuration },
    update: { name: update.name, activityCount: update.activities.length, completionDate: updateCpm.completionDate, projectDuration: updateCpm.projectDuration },
    completionDeltaDays: updateCpm.projectDuration - baselineCpm.projectDuration,
    activityVariances: activityVariances.sort((a, b) => a.id.localeCompare(b.id)),
    summary: { added: count("added"), removed: count("removed"), changed: count("changed"), unchanged: count("unchanged"), warnings },
  };
}

export function comparisonToCsv(comparison: ScheduleComparison) {
  const quote = (value: string | number | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const header = ["معرف النشاط", "اسم النشاط", "الحالة", "مدة الأساس", "مدة التحديث", "فرق المدة", "ملاحظات"];
  const rows = comparison.activityVariances.map((item) => [item.id, item.name, item.status, item.baselineDuration, item.updateDuration, item.durationDelta, item.notes.join("؛ ")]);
  return [header, ...rows].map((row) => row.map(quote).join(",")).join("\n");
}
