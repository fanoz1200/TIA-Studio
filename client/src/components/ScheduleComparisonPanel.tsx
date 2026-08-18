import React, { useMemo, useRef, useState, type RefObject } from "react";
import "./schedule-comparison.css";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, FileDiff, FileUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GanttComparisonChart } from "@/components/GanttComparisonChart";
import { importP6XmlSchedule } from "@/lib/p6-xml";
import { comparisonToCsv, compareScheduleUpdates } from "@/lib/schedule-comparison";
import { importXerSchedule } from "@/lib/xer";
import type { Schedule } from "@/lib/cpm";

type SourceSlot = "baseline" | "update";

function downloadText(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

function parseSchedule(raw: string, name: string): Schedule {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xer")) return importXerSchedule(raw, name).schedule;
  if (lower.endsWith(".xml")) return importP6XmlSchedule(raw, name).schedule;
  const parsed = JSON.parse(raw) as Schedule;
  if (!parsed.id || !parsed.name || !Array.isArray(parsed.activities) || !Array.isArray(parsed.relationships)) throw new Error("ملف JSON لا يطابق نموذج البرنامج.");
  return parsed;
}

export function ScheduleComparisonPanel({ currentSchedule }: { currentSchedule: Schedule }) {
  const [baseline, setBaseline] = useState<Schedule | null>(null);
  const [update, setUpdate] = useState<Schedule | null>(null);
  const [isReading, setIsReading] = useState<SourceSlot | null>(null);
  const baselineRef = useRef<HTMLInputElement>(null);
  const updateRef = useRef<HTMLInputElement>(null);
  const comparison = useMemo(() => baseline && update ? compareScheduleUpdates(baseline, update) : null, [baseline, update]);

  async function readFile(slot: SourceSlot, file: File) {
    setIsReading(slot);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const parsed = parseSchedule(await file.text(), file.name);
      if (slot === "baseline") setBaseline(parsed); else setUpdate(parsed);
      toast.success(`تم تحميل ${slot === "baseline" ? "البرنامج المرجعي" : "تحديث البرنامج"}: ${parsed.name}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر قراءة ملف البرنامج."); }
    finally { setIsReading(null); }
  }

  const slot = (kind: SourceSlot, title: string, value: Schedule | null, inputRef: RefObject<HTMLInputElement | null>) => <section className={`comparison-source ${value ? "is-ready" : ""}`}>
    <div className="comparison-source-head"><span className="comparison-step">{kind === "baseline" ? "01" : "02"}</span><div><p>{title}</p><b>{value?.name ?? "لم يُحمّل بعد"}</b></div>{value ? <CheckCircle2 size={19} /> : <FileDiff size={19} />}</div>
    <small>{value ? `${value.activities.length} نشاط · يبدأ ${value.startDate}` : "يدعم XER وP6 XML وJSON. لا تغادر الملفات المتصفح أثناء المقارنة."}</small>
    <div className="comparison-source-actions"><Button variant="outline" size="sm" disabled={isReading !== null} onClick={() => inputRef.current?.click()}>{isReading === kind ? <LoaderCircle size={15} className="animate-spin" /> : <FileUp size={15} />}{isReading === kind ? "جارِ القراءة…" : "تحميل ملف"}</Button>{value ? <Button variant="ghost" size="sm" onClick={() => kind === "baseline" ? setBaseline(null) : setUpdate(null)}><Trash2 size={15} />إزالة</Button> : null}</div>
    <input ref={inputRef} type="file" accept=".xer,.xml,.json,text/plain,application/json,text/xml" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(kind, file); event.currentTarget.value = ""; }} />
  </section>;

  return <div className="view-stack comparison-view" dir="rtl"><section className="page-heading"><div><p className="eyebrow">UPDATE VARIANCE WORKSPACE</p><h1>مقارنة تحديثات البرنامج</h1><p>قارن برنامجين محددين من ملفاتك، ثم راجع فروق الأنشطة والمدة وتاريخ الإكمال. المقارنة فنية ولا تُقرر الاستحقاق التعاقدي بذاتها.</p></div><div className="heading-actions"><Button variant="outline" className="outline-action" onClick={() => { setBaseline(currentSchedule); toast.success("حُمّل البرنامج المفتوح كبرنامج مرجعي."); }}><Plus size={16} />استخدم البرنامج المفتوح كأساس</Button></div></section>
    <section className="comparison-workspace">{slot("baseline", "البرنامج المرجعي / السابق", baseline, baselineRef)}<div className="comparison-transfer"><ArrowLeftRight size={22} /><span>قارن نفس نطاق المشروع قدر الإمكان</span></div>{slot("update", "تحديث البرنامج / اللاحق", update, updateRef)}</section>
    {comparison ? <><section className="comparison-kpis"><div><small>فرق مدة المشروع</small><b className={comparison.completionDeltaDays > 0 ? "is-delay" : comparison.completionDeltaDays < 0 ? "is-gain" : ""}>{comparison.completionDeltaDays > 0 ? "+" : ""}{comparison.completionDeltaDays} يوم</b><span>{comparison.baseline.completionDate} ← {comparison.update.completionDate}</span></div><div><small>أنشطة مُعدّلة</small><b>{comparison.summary.changed}</b><span>من أصل {comparison.update.activityCount} نشاط في التحديث</span></div><div><small>تغييرات نطاق</small><b>{comparison.summary.added + comparison.summary.removed}</b><span>مضاف {comparison.summary.added} · محذوف {comparison.summary.removed}</span></div></section>
      {comparison.summary.warnings.length ? <section className="comparison-warnings">{comparison.summary.warnings.map((warning) => <div key={warning}><AlertTriangle size={17} /><span>{warning}</span></div>)}</section> : null}
      {baseline && update ? <GanttComparisonChart baseline={baseline} update={update} comparison={comparison} onExport={() => downloadText("tia-update-comparison.csv", comparisonToCsv(comparison), "text/csv;charset=utf-8")} /> : null}</> : <section className="comparison-empty"><FileDiff size={28} /><div><b>حمّل برنامجين لبدء المقارنة</b><p>اختر نسخة مرجعية ثم تحديثاً لنفس المشروع. يمكنك استخدام البرنامج المفتوح كأساس أو تحميل XER/XML/JSON.</p></div></section>}</div>;
}
