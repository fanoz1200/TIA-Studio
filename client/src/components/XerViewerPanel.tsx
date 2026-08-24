import React from "react";
import { AlertTriangle, CalendarDays, FileCode2, GitCompareArrows, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Schedule } from "@/lib/cpm";
import type { XerImportSummary } from "@/lib/xer";
import type { ScheduleSnapshot } from "@/components/GuidedAnalysisPanel";
import "./xer-viewer.css";

type Props = {
  schedule: Schedule;
  xerSummary: XerImportSummary | null;
  baselineSnapshot: ScheduleSnapshot | null;
  updateSnapshots: ScheduleSnapshot[];
  onNavigate: (view: "schedule" | "compare") => void;
};

type ViewerSnapshot = {
  id: string;
  label: string;
  fileName: string;
  schedule: Schedule;
  summary?: XerImportSummary;
};

function snapshotLabel(snapshot: ScheduleSnapshot) {
  if (snapshot.stage === "baseline") return "Baseline المعتمد";
  if (snapshot.stage === "pre-event-update") return "Update قبل الحدث";
  return "Update لاحق";
}

function ScheduleFacts({ schedule, summary }: { schedule: Schedule; summary?: XerImportSummary }) {
  const calendar = schedule.calendar;
  return (
    <dl className="xer-viewer__facts">
      <div><dt>Data Date</dt><dd>{schedule.dataDate ?? "غير مسجل"}</dd></div>
      <div><dt>الأنشطة</dt><dd>{schedule.activities.length}</dd></div>
      <div><dt>العلاقات</dt><dd>{schedule.relationships.length}</dd></div>
      <div><dt>WBS</dt><dd>{new Set(schedule.activities.map(item => item.wbs).filter(Boolean)).size || "غير مقروء"}</dd></div>
      <div><dt>التقويم</dt><dd>{calendar?.name ?? "غير مسجل"}</dd></div>
      <div><dt>أيام العمل</dt><dd>{calendar?.workingWeekdays?.length ?? 0} أيام/أسبوع</dd></div>
      <div><dt>تقويمات الأنشطة</dt><dd>{summary ? `${summary.taskCalendarCount ?? summary.taskCalendarIds?.length ?? 0} معرف` : "غير مقروء"}</dd></div>
      <div><dt>قيود XER</dt><dd>{summary ? `${summary.supportedConstraintsRead ?? 0} محسوب · ${summary.unsupportedConstraintsRead ?? 0} مراجعة` : "غير مقروء"}</dd></div>
      <div><dt>حالة التحديث</dt><dd>{summary ? `${summary.activitiesWithProgress ?? 0} نشاط — محفوظة للمراجعة، لا F9 محلي` : "غير مقروء"}</dd></div>
    </dl>
  );
}

export function XerViewerPanel({ schedule, xerSummary, baselineSnapshot, updateSnapshots, onNavigate }: Props) {
  const snapshots: ViewerSnapshot[] = [
    ...(baselineSnapshot ? [{ id: baselineSnapshot.id, label: snapshotLabel(baselineSnapshot), fileName: baselineSnapshot.fileName, schedule: baselineSnapshot.schedule, summary: baselineSnapshot.summary }] : []),
    ...updateSnapshots.map(snapshot => ({ id: snapshot.id, label: snapshotLabel(snapshot), fileName: snapshot.fileName, schedule: snapshot.schedule, summary: snapshot.summary })),
  ];
  const baseline = baselineSnapshot?.schedule ?? schedule;
  const current = snapshots.at(-1)?.schedule ?? schedule;
  const addedActivities = current.activities.filter(activity => !baseline.activities.some(item => item.id === activity.id));
  const removedActivities = baseline.activities.filter(activity => !current.activities.some(item => item.id === activity.id));

  return <section className="xer-viewer" aria-labelledby="xer-viewer-title">
    <header className="xer-viewer__header">
      <div className="xer-viewer__title"><span><FileCode2 size={22} /></span><div><p className="eyebrow">مراجعة محلية قبل Primavera</p><h1 id="xer-viewer-title">عارض XER والنسخ</h1><p>تقدر تشوف اللي البرنامج قرأه من الملف، وتراجع الفرق قبل ما تعمل Reverse Import أو F9 على نسخة Primavera غير إنتاجية.</p></div></div>
      <div className="xer-viewer__actions"><Button variant="outline" onClick={() => onNavigate("schedule")}>ارفع أو استبدل ملف</Button><Button onClick={() => onNavigate("compare")}><GitCompareArrows size={16} /> افتح المقارنة</Button></div>
    </header>

    <div className="xer-viewer__notice"><AlertTriangle size={18} /><p><b>حدود العارض:</b> قراءة ومراجعة محلية فقط. لا يعدّل ملف XER الأصلي، ولا يثبت تطابقاً كاملاً مع Primavera أو صلاحية أي مطالبة.</p></div>

    <div className="xer-viewer__summary">
      <article><Network size={20} /><div><span>المشروع المفتوح</span><strong>{schedule.name}</strong><small>المصدر: {schedule.source ?? "محلي"}</small></div></article>
      <article><CalendarDays size={20} /><div><span>التقويم المستخدم</span><strong>{schedule.calendar?.name ?? "غير مسجل"}</strong><small>{schedule.calendar?.holidaySource ?? "راجع التقويم يدوياً"}</small></div></article>
      <article><FileCode2 size={20} /><div><span>آخر قراءة XER</span><strong>{xerSummary ? `${xerSummary.activitiesRead} نشاط` : "لم يُرفع XER بعد"}</strong><small>{xerSummary ? `${xerSummary.relationshipsRead} علاقة مقروءة` : "يمكنك البدء بملف XER أو P6 XML"}</small></div></article>
    </div>

    <section className="xer-viewer__section" aria-labelledby="xer-files-title"><div className="xer-viewer__section-heading"><div><h2 id="xer-files-title">الملفات والنسخ اللي بتقارنها</h2><p>كل ملف مرفوع يفضل منفصل؛ البرنامج لا يخلط Baseline مع الـUpdates تلقائياً.</p></div><Badge className="badge-muted">{snapshots.length} ملف/نسخة</Badge></div>
      {snapshots.length ? <div className="xer-viewer__snapshots">{snapshots.map(snapshot => <article key={snapshot.id} className="xer-viewer__snapshot"><div><Badge className="badge-blue">{snapshot.label}</Badge><h3>{snapshot.fileName}</h3><p>{snapshot.schedule.name}</p></div><ScheduleFacts schedule={snapshot.schedule} summary={snapshot.summary} /></article>)}</div> : <div className="xer-viewer__empty"><FileCode2 size={28} /><div><h3>لسه مفيش نسخة مرفوعة للعرض</h3><p>ارفع Baseline وبعده Update قبل الحدث من شاشة رفع P6. ده أفضل ترتيب لمراجعة TIA.</p><Button onClick={() => onNavigate("schedule")}>روح لرفع P6</Button></div></div>}</section>

    <section className="xer-viewer__section" aria-labelledby="xer-diff-title"><div className="xer-viewer__section-heading"><div><h2 id="xer-diff-title">فرق سريع بين Baseline وآخر نسخة</h2><p>دي مقارنة تعريفية بالمعرفات والعدادات، مش حكم تأخيري نهائي.</p></div></div>
      <div className="xer-viewer__diff"><article><span>أنشطة أُضيفت</span><strong>{addedActivities.length}</strong><p>{addedActivities.slice(0, 5).map(item => item.id).join("، ") || "لا يوجد"}</p></article><article><span>أنشطة اختفت</span><strong>{removedActivities.length}</strong><p>{removedActivities.slice(0, 5).map(item => item.id).join("، ") || "لا يوجد"}</p></article><article><span>فرق العلاقات</span><strong>{current.relationships.length - baseline.relationships.length > 0 ? "+" : ""}{current.relationships.length - baseline.relationships.length}</strong><p>{baseline.relationships.length} في Baseline ← {current.relationships.length} في النسخة الحالية</p></article><article><span>فرق Data Date</span><strong>{baseline.dataDate === current.dataDate ? "نفس التاريخ" : "راجع"}</strong><p>{baseline.dataDate ?? "غير مسجل"} ← {current.dataDate ?? "غير مسجل"}</p></article></div></section>

    <section className="xer-viewer__section" aria-labelledby="xer-activities-title"><div className="xer-viewer__section-heading"><div><h2 id="xer-activities-title">معاينة الأنشطة المقروءة</h2><p>أول 30 نشاطاً من البرنامج المفتوح حالياً. استخدم جدول البرنامج للبحث والفلترة الكاملة.</p></div></div><div className="xer-viewer__table-wrap"><table><thead><tr><th>Activity ID</th><th>اسم النشاط</th><th>WBS</th><th>المدة</th><th>المسؤول</th></tr></thead><tbody>{schedule.activities.slice(0, 30).map(activity => <tr key={activity.id}><td dir="ltr">{activity.id}</td><td>{activity.name}</td><td>{activity.wbs ?? "—"}</td><td>{activity.duration} يوم</td><td>{activity.owner ?? "—"}</td></tr>)}</tbody></table></div></section>
  </section>;
}
