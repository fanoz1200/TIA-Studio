import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileCode2, History, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Schedule } from "@/lib/cpm";
import type { XerImportSummary } from "@/lib/xer";
import { assessScheduleQuality, buildQualityLedgerEntry, type QualityLedgerEntry, type QualitySeverity } from "@/lib/schedule-quality";

type Props = {
  view: string;
  schedule: Schedule;
  xerSummary?: XerImportSummary | null;
  onNavigate: (view: "schedule" | "guided" | "analysis") => void;
};

const ledgerKey = "tia-schedule-quality-ledger-v1";
const severityCopy: Record<QualitySeverity, { label: string; className: string }> = {
  pass: { label: "سليم", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  warning: { label: "مراجعة", className: "bg-amber-50 text-amber-800 border-amber-200" },
  blocker: { label: "مانع", className: "bg-red-50 text-red-800 border-red-200" },
};

function readLedger(): QualityLedgerEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ledgerKey) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.slice(0, 12) as QualityLedgerEntry[] : [];
  } catch {
    return [];
  }
}

function stateLabel(state: "ready" | "review" | "blocked") {
  return state === "ready" ? "جاهز" : state === "review" ? "جاهز بعد مراجعة" : "موقوف";
}

/** بوابة محلية؛ سجل التحسين يتتبع تغيّر قواعد الجودة ولا يرسل البرنامج أو محتواه إلى خدمة خارجية. */
export function ScheduleQualityPanel({ view, schedule, xerSummary, onNavigate }: Props) {
  const assessment = useMemo(() => assessScheduleQuality(schedule, xerSummary), [schedule, xerSummary]);
  const [history, setHistory] = useState<QualityLedgerEntry[]>(readLedger);

  useEffect(() => {
    const next = buildQualityLedgerEntry(schedule, assessment);
    setHistory((previous) => {
      const latest = previous[0];
      if (latest?.scheduleFingerprint === next.scheduleFingerprint && latest.summary.warnings === next.summary.warnings && latest.summary.blockers === next.summary.blockers) return previous;
      const updated = [next, ...previous].slice(0, 12);
      try { window.localStorage.setItem(ledgerKey, JSON.stringify(updated)); } catch { /* لا يعتمد التحليل على مساحة تخزين المتصفح */ }
      return updated;
    });
  }, [assessment, schedule]);

  if (view !== "quality") return null;
  const statusClass = assessment.analysisReadiness === "blocked" ? "bg-red-50 text-red-800 border-red-200" : assessment.analysisReadiness === "review" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200";
  const statusIcon = assessment.analysisReadiness === "blocked" ? <AlertTriangle size={19} /> : <ShieldCheck size={19} />;

  return <div className="view-stack max-w-6xl mx-auto px-4 py-6 gap-5" dir="rtl">
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-l from-slate-950 via-slate-900 to-sky-950 text-white p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
        <div className="max-w-3xl"><p className="text-xs font-bold tracking-[0.16em] text-sky-200">SCHEDULE QUALITY GATE · فحص قبل التحليل والتصدير</p><h1 className="mt-2 text-2xl md:text-3xl font-bold">بوابة جودة البرنامج وسجل التحسين</h1><p className="mt-3 text-sm leading-7 text-slate-200">تفحص هذه البوابة بنية الشبكة والتقويم وبيانات XER المقروءة قبل تشغيل TIA. النتيجة فنية قابلة للتتبع؛ لا تحسم العقد أو الاستحقاق أو توافق كل نسخة من Primavera.</p></div>
        <div className="min-w-52 rounded-2xl border border-white/20 bg-white/10 p-4"><div className="flex items-center gap-2 text-sky-100">{statusIcon}<b>جاهزية تحليل TIA</b></div><strong className="mt-3 block text-xl">{stateLabel(assessment.analysisReadiness)}</strong><span className="mt-1 block text-sm text-slate-200">{assessment.summary.blockers} مانع · {assessment.summary.warnings} مراجعة · {assessment.summary.passed} سليم</span></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><Button className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => onNavigate("schedule")}><Upload size={16} />راجع أو ارفع البرنامج</Button><Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" disabled={assessment.analysisReadiness === "blocked"} onClick={() => onNavigate("guided")}><ClipboardCheck size={16} />تابع إلى رحلة TIA</Button></div>
    </section>

    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">معرّف لقطة الجودة</p><b className="mt-2 block font-mono text-slate-900" dir="ltr">{assessment.scheduleFingerprint}</b><span className="mt-2 block text-sm text-slate-600">يغيّر السجل اللقطة عند تغير شبكة أو تقويم البرنامج.</span></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">قابلية تصدير XER التجريبي</p><b className="mt-2 block text-slate-900">{stateLabel(assessment.exportReadiness)}</b><span className="mt-2 block text-sm text-slate-600">يلزم الاستيراد العكسي ثم فحص نسخة P6 المطابقة قبل الاستخدام الرسمي.</span></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">نطاق الفحص</p><b className="mt-2 block text-slate-900">CPM · Calendar · WBS · XER</b><span className="mt-2 block text-sm text-slate-600">يحتفظ بمعرفات تقويم النشاط وActuals/Remaining للمراجعة، ويدعم SNET/FNET بشكل محدود؛ لا يعيد جدولة Update كـP6/F9، والقيود الأخرى وأنماط P6 تحتاج مراجعة مانعة داخل P6.</span></article>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">قواعد الفحص القابلة للتفسير</h2><p className="mt-1 text-sm text-slate-600">كل تحذير يوضح سبب المراجعة والإجراء المطلوب، بدلاً من درجة عامة لا يمكن تدقيقها.</p></div><div className="divide-y divide-slate-100">{assessment.rules.map((item) => { const copy = severityCopy[item.severity]; const Icon = item.severity === "pass" ? CheckCircle2 : AlertTriangle; return <article key={item.id} className="p-5 flex flex-col lg:flex-row lg:items-start gap-4"><span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${copy.className}`}><Icon size={14} />{copy.label}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><b className="text-slate-900">{item.id} — {item.title}</b>{item.affectedCount !== undefined ? <span className="text-xs text-slate-500">{item.affectedCount} عنصر متأثر</span> : null}</div><p className="mt-1 text-sm leading-6 text-slate-700">{item.detail}</p><p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"><strong>الإجراء:</strong> {item.action}</p></div></article>; })}</div></section>

    <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><History size={19} className="text-sky-700" /><h2 className="font-bold text-slate-900">سجل التحسين المحلي</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">يحفظ هذا السجل في متصفحك فقط، ويعطي فريق المشروع مقارنة بين لقطات الفحص دون إرسال ملف البرنامج أو محتواه للخارج.</p><div className="mt-4 space-y-3">{history.length ? history.slice(0, 4).map((entry) => <div key={`${entry.scheduleFingerprint}-${entry.generatedAt}`} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between gap-2"><b className="text-sm text-slate-800" dir="ltr">{entry.scheduleFingerprint}</b><span className="text-xs text-slate-500">{new Date(entry.generatedAt).toLocaleString("ar-EG")}</span></div><span className="mt-1 block text-sm text-slate-600">{entry.summary.blockers} مانع · {entry.summary.warnings} مراجعة · {entry.summary.passed} سليم</span></div>) : <p className="text-sm text-slate-500">سيظهر سجل الفحص بعد تحميل أو تعديل البرنامج.</p>}</div></article><article className="rounded-2xl border border-sky-100 bg-sky-50 p-5"><div className="flex items-center gap-2"><FileCode2 size={19} className="text-sky-800" /><h2 className="font-bold text-slate-900">قرار تصدير XER</h2></div><p className="mt-3 text-sm leading-7 text-slate-700">المُصدّر يحافظ فقط على PROJECT وCALENDAR وPROJWBS وTASK وTASKPRED ضمن النطاق المعلن. تعني «جاهز بعد مراجعة» أن بنية التطبيق سليمة داخلياً، لا أن Oracle Primavera سيقبل كل حقل أو إصدار تلقائياً.</p><a className="mt-4 inline-flex text-sm font-bold text-sky-800 underline underline-offset-4" href="https://docs.oracle.com/cd/F51303_01/English/Mapping_and_Schema/xer_import_export_data_map_project/index.htm" target="_blank" rel="noreferrer">راجع خريطة بيانات Oracle XER الرسمية</a></article></section>
  </div>;
}
