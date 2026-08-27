import React from "react";
import { AlertTriangle, CalendarDays, FileCode2, GitCompareArrows, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppLanguage } from "@/contexts/LanguageContext";
import type { Schedule } from "@/lib/cpm";
import { bilingualUiLabel } from "@/lib/language";
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

function snapshotLabel(snapshot: ScheduleSnapshot, language: "ar" | "en") {
  if (language === "en") {
    if (snapshot.stage === "baseline") return "Approved baseline";
    if (snapshot.stage === "pre-event-update") return "Pre-event update";
    return "Later update";
  }
  if (snapshot.stage === "baseline") return "Baseline المعتمد";
  if (snapshot.stage === "pre-event-update") return "Update قبل الحدث";
  return "Update لاحق";
}

function ScheduleFacts({ schedule, summary, language }: { schedule: Schedule; summary?: XerImportSummary; language: "ar" | "en" }) {
  const calendar = schedule.calendar;
  const txt = (ar: string, en: string) => language === "en" ? en : ar;
  const ui = (ar: string, en: string) => bilingualUiLabel(language, ar, en);
  return (
    <dl className="xer-viewer__facts">
      <div><dt>{ui("تاريخ البيانات", "Data Date")}</dt><dd>{schedule.dataDate ?? txt("غير مسجل", "Not recorded")}</dd></div>
      <div><dt>{ui("الأنشطة", "Activities")}</dt><dd>{schedule.activities.length}</dd></div>
      <div><dt>{ui("العلاقات", "Relationships")}</dt><dd>{schedule.relationships.length}</dd></div>
      <div><dt>WBS</dt><dd>{new Set(schedule.activities.map(item => item.wbs).filter(Boolean)).size || txt("غير مقروء", "Not read")}</dd></div>
      <div><dt>{ui("التقويم", "Calendar")}</dt><dd>{calendar?.name ?? txt("غير مسجل", "Not recorded")}</dd></div>
      <div><dt>{ui("أيام العمل", "Working days")}</dt><dd>{calendar?.workingWeekdays?.length ?? 0} {txt("أيام/أسبوع", "days/week")}</dd></div>
      <div><dt>{ui("تقويمات الأنشطة", "Activity calendars")}</dt><dd>{summary ? `${summary.taskCalendarCount ?? summary.taskCalendarIds?.length ?? 0} ${txt("معرّف", "ID(s)")}` : txt("غير مقروء", "Not read")}</dd></div>
      <div><dt>{ui("مصدر XER الخام", "Raw XER source")}</dt><dd>{schedule.xerSource?.rawText ? txt("محفوظ في الجلسة", "Held for this session") : txt("غير متاح", "Not available")}</dd></div>
      <div><dt>{ui("تقويم Primavera", "Primavera calendar")}</dt><dd>{schedule.xerSource?.projectCalendarId ? `${txt("مرجع", "Reference")}: ${schedule.xerSource.projectCalendarId} · ${txt("غير مفكوك", "not decoded")}` : txt("غير متاح", "Not available")}</dd></div>
      <div><dt>{ui("قيود XER", "XER constraints")}</dt><dd>{summary ? `${summary.supportedConstraintsRead ?? 0} ${txt("محسوب", "supported")} · ${summary.unsupportedConstraintsRead ?? 0} ${txt("مراجعة", "review")}` : txt("غير مقروء", "Not read")}</dd></div>
      <div><dt>{ui("حالة التحديث", "Update state")}</dt><dd>{summary ? `${summary.activitiesWithProgress ?? 0} ${txt("نشاط — محفوظة للمراجعة، لا F9 محلي", "activity(ies) — retained for review; no local F9")}` : txt("غير مقروء", "Not read")}</dd></div>
    </dl>
  );
}

export function XerViewerPanel({ schedule, xerSummary, baselineSnapshot, updateSnapshots, onNavigate }: Props) {
  const { language, direction } = useAppLanguage();
  const txt = (ar: string, en: string) => language === "en" ? en : ar;
  const ui = (ar: string, en: string) => bilingualUiLabel(language, ar, en);
  const snapshots: ViewerSnapshot[] = [
    ...(baselineSnapshot ? [{ id: baselineSnapshot.id, label: snapshotLabel(baselineSnapshot, language), fileName: baselineSnapshot.fileName, schedule: baselineSnapshot.schedule, summary: baselineSnapshot.summary }] : []),
    ...updateSnapshots.map(snapshot => ({ id: snapshot.id, label: snapshotLabel(snapshot, language), fileName: snapshot.fileName, schedule: snapshot.schedule, summary: snapshot.summary })),
  ];
  const baseline = baselineSnapshot?.schedule ?? schedule;
  const current = snapshots.at(-1)?.schedule ?? schedule;
  const addedActivities = current.activities.filter(activity => !baseline.activities.some(item => item.id === activity.id));
  const removedActivities = baseline.activities.filter(activity => !current.activities.some(item => item.id === activity.id));

  return <section className="xer-viewer" aria-labelledby="xer-viewer-title" dir={direction}>
    <header className="xer-viewer__header">
      <div className="xer-viewer__title"><span><FileCode2 size={22} /></span><div><p className="eyebrow">{ui("مراجعة محلية قبل بريمافيرا", "Local review before Primavera")}</p><h1 id="xer-viewer-title">{ui("عارض XER والنسخ", "XER and snapshot viewer")}</h1><p>{txt("تقدر تشوف اللي البرنامج قرأه من الملف، وتراجع الفرق قبل ما تعمل Reverse Import أو F9 على نسخة Primavera غير إنتاجية.", "Review what the application read from the file and compare snapshots before Reverse Import or F9 in a non-production Primavera copy.")}</p></div></div>
      <div className="xer-viewer__actions"><Button variant="outline" onClick={() => onNavigate("schedule")}>{ui("ارفع أو استبدل ملف", "Upload or replace file")}</Button><Button onClick={() => onNavigate("compare")}><GitCompareArrows size={16} /> {ui("افتح المقارنة", "Open comparison")}</Button></div>
    </header>

    <div className="xer-viewer__notice"><AlertTriangle size={18} /><p><b>{txt("حدود العارض:", "Viewer limits:")}</b> {schedule.xerSource?.rawText ? txt("الملف الأصلي محفوظ محلياً داخل الجلسة لتصدير Pre حرفي وPost محافظ عند اجتياز فحوص الحقن. لا يفك العارض clndr_data أو وراثة تقاويم P6، ولا يثبت تطابق الحساب أو قبول Primavera قبل Reverse Import وF9.", "The original file is held locally for this session so Pre can be exact and Post can be conservative after injection checks. The viewer does not decode clndr_data or P6 calendar inheritance, and it does not prove calculation parity or Primavera acceptance before Reverse Import and F9.") : txt("قراءة ومراجعة محلية فقط. لا يعدّل ملف XER الأصلي، ولا يثبت تطابقاً كاملاً مع Primavera أو صلاحية أي مطالبة.", "Local reading and review only. It does not modify the original XER, and it does not prove full Primavera equivalence or entitlement for any claim.")}</p></div>

    <div className="xer-viewer__summary">
      <article><Network size={20} /><div><span>{ui("المشروع المفتوح", "Open project")}</span><strong>{schedule.name}</strong><small>{txt("المصدر:", "Source:")} {schedule.source ?? txt("محلي", "Local")}</small></div></article>
      <article><CalendarDays size={20} /><div><span>{ui("التقويم المستخدم", "Calendar in use")}</span><strong>{schedule.calendar?.name ?? txt("غير مسجل", "Not recorded")}</strong><small>{schedule.xerSource?.projectCalendarId ? `${txt("مرجع P6", "P6 reference")}: ${schedule.xerSource.projectCalendarId} · ${txt("مطلوب تحقق داخل P6", "P6 verification required")}` : schedule.calendar?.holidaySource ?? txt("راجع التقويم يدوياً", "Review the calendar manually")}</small></div></article>
      <article><FileCode2 size={20} /><div><span>{ui("آخر قراءة XER", "Latest XER read")}</span><strong>{xerSummary ? `${xerSummary.activitiesRead} ${txt("نشاط", "activity(ies)")}` : txt("لم يُرفع XER بعد", "No XER uploaded yet")}</strong><small>{xerSummary ? `${xerSummary.relationshipsRead} ${txt("علاقة مقروءة", "relationship(s) read")}` : txt("يمكنك البدء بملف XER أو P6 XML", "Start with an XER or P6 XML file")}</small></div></article>
    </div>

    <section className="xer-viewer__section" aria-labelledby="xer-files-title"><div className="xer-viewer__section-heading"><div><h2 id="xer-files-title">{ui("الملفات والنسخ التي تقارنها", "Files and snapshots being compared")}</h2><p>{txt("كل ملف مرفوع يفضل منفصل؛ البرنامج لا يخلط Baseline مع الـUpdates تلقائياً.", "Each uploaded file remains separate; the application does not automatically merge the baseline with updates.")}</p></div><Badge className="badge-muted">{snapshots.length} {txt("ملف/نسخة", "file(s)/snapshot(s)")}</Badge></div>
      {snapshots.length ? <div className="xer-viewer__snapshots">{snapshots.map(snapshot => <article key={snapshot.id} className="xer-viewer__snapshot"><div><Badge className="badge-blue">{snapshot.label}</Badge><h3>{snapshot.fileName}</h3><p>{snapshot.schedule.name}</p></div><ScheduleFacts schedule={snapshot.schedule} summary={snapshot.summary} language={language} /></article>)}</div> : <div className="xer-viewer__empty"><FileCode2 size={28} /><div><h3>{txt("لسه مفيش نسخة مرفوعة للعرض", "No snapshot uploaded for viewing yet")}</h3><p>{txt("ارفع Baseline وبعده Update قبل الحدث من شاشة رفع P6. ده أفضل ترتيب لمراجعة TIA.", "Upload a baseline and then a pre-event update from the P6 upload screen. This is the preferred order for a TIA review.")}</p><Button onClick={() => onNavigate("schedule")}>{txt("روح لرفع P6", "Go to P6 upload")}</Button></div></div>}</section>

    <section className="xer-viewer__section" aria-labelledby="xer-diff-title"><div className="xer-viewer__section-heading"><div><h2 id="xer-diff-title">{ui("فرق سريع بين خط الأساس وآخر نسخة", "Quick baseline-to-current comparison")}</h2><p>{txt("دي مقارنة تعريفية بالمعرفات والعدادات، مش حكم تأخيري نهائي.", "This is an identifier-and-count comparison, not a final delay finding.")}</p></div></div>
      <div className="xer-viewer__diff"><article><span>{ui("أنشطة أُضيفت", "Activities added")}</span><strong>{addedActivities.length}</strong><p>{addedActivities.slice(0, 5).map(item => item.id).join("، ") || txt("لا يوجد", "None")}</p></article><article><span>{ui("أنشطة اختفت", "Activities removed")}</span><strong>{removedActivities.length}</strong><p>{removedActivities.slice(0, 5).map(item => item.id).join("، ") || txt("لا يوجد", "None")}</p></article><article><span>{ui("فرق العلاقات", "Relationship difference")}</span><strong>{current.relationships.length - baseline.relationships.length > 0 ? "+" : ""}{current.relationships.length - baseline.relationships.length}</strong><p>{language === "en" ? `${baseline.relationships.length} in baseline → ${current.relationships.length} in current snapshot` : `${baseline.relationships.length} في Baseline ← ${current.relationships.length} في النسخة الحالية`}</p></article><article><span>{ui("فرق Data Date", "Data Date difference")}</span><strong>{baseline.dataDate === current.dataDate ? txt("نفس التاريخ", "Same date") : txt("راجع", "Review")}</strong><p>{baseline.dataDate ?? txt("غير مسجل", "Not recorded")} ← {current.dataDate ?? txt("غير مسجل", "Not recorded")}</p></article></div></section>

    <section className="xer-viewer__section" aria-labelledby="xer-activities-title"><div className="xer-viewer__section-heading"><div><h2 id="xer-activities-title">{ui("معاينة الأنشطة المقروءة", "Read activity preview")}</h2><p>{txt("أول 30 نشاطاً من البرنامج المفتوح حالياً. استخدم جدول البرنامج للبحث والفلترة الكاملة.", "The first 30 activities from the current schedule. Use the schedule table for full search and filtering.")}</p></div></div><div className="xer-viewer__table-wrap"><table><thead><tr><th>Activity ID</th><th>{ui("اسم النشاط", "Activity name")}</th><th>WBS</th><th>{ui("المدة", "Duration")}</th><th>{ui("المسؤول", "Owner")}</th></tr></thead><tbody>{schedule.activities.slice(0, 30).map(activity => <tr key={activity.id}><td dir="ltr">{activity.id}</td><td>{activity.name}</td><td>{activity.wbs ?? "—"}</td><td>{activity.duration} {txt("يوم", "day(s)")}</td><td>{activity.owner ?? "—"}</td></tr>)}</tbody></table></div></section>
  </section>;
}
