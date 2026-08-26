import React, { useMemo, useRef, useState, type RefObject } from "react";
import "./schedule-comparison.css";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Download, FileDiff, FileUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GanttComparisonChart } from "@/components/GanttComparisonChart";
import { importP6XmlSchedule } from "@/lib/p6-xml";
import { comparisonToCsv, compareScheduleUpdates } from "@/lib/schedule-comparison";
import { importXerSchedule } from "@/lib/xer";
import { exportExperimentalXer, validateExperimentalXerRoundTrip } from "@/lib/xer-export";
import { insertFragnet, type Fragnet, type Schedule } from "@/lib/cpm";
import { assessScheduleQuality } from "@/lib/schedule-quality";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { bilingualUiLabel } from "@/lib/language";

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

export function ScheduleComparisonPanel({ currentSchedule, selectedEvent }: { currentSchedule: Schedule; selectedEvent?: Fragnet | null }) {
  const { language, direction } = useAppLanguage();
  const bi = (arabic: string, english: string) => bilingualUiLabel(language, arabic, english);
  const tx = language === "en" ? {
    eyebrow: "UPDATE VARIANCE WORKSPACE", title: "Schedule update comparison", description: "Compare two defined schedules from your files, then review activity, duration, and completion-date variances. The comparison is technical and does not determine contractual entitlement by itself.",
    context: "The XER downloads below are exchange-only and experimental: review them separately in Primavera and do not treat them as a source-file replacement.", useOpen: "Use the open schedule as baseline", preXer: "Download Pre-TIA XER", postXer: "Download Post-TIA XER",
    baseline: "Baseline / previous schedule", update: "Update / later schedule", notLoaded: "Not loaded yet", activities: "activities", starts: "starts", support: "Supports XER, P6 XML, and JSON. Files do not leave the browser during comparison.",
    loading: "Reading…", upload: "Upload file", remove: "Remove", transfer: "Compare the same project scope where possible", durationVariance: "Project duration variance", changedActivities: "Changed activities", scopeChanges: "Scope changes", from: "out of", inUpdate: "activities in the update", added: "added", removed: "removed", days: "days",
    emptyTitle: "Load two schedules to start comparing", emptyDescription: "Choose a baseline version and then an update for the same project. You can use the open schedule as a baseline or load XER/XML/JSON.",
    loadSuccess: "Loaded", openSuccess: "The open schedule was loaded as the baseline.", genericReadError: "Could not read the schedule file.", xerQualityBlocked: "XER download stopped: correct schedule-quality blockers first", xerRoundTripBlocked: "XER download stopped:", xerRoundTripFallback: "Round-trip import validation failed.", xerDownloadSuccess: "Experimental", preTiaSnapshot: "Pre-TIA", postTiaSnapshot: "Post-TIA", xerDownloaded: "XER was downloaded after round-trip import validation:", relationships: "relationships", conjunction: "and", xerCreateError: "Could not create the experimental XER file.", xerReview: "Review calendar constraints and unsupported P6 fields in the download message before using the file externally.",
  } : {
    eyebrow: bi("مساحة عمل فروق التحديثات", "UPDATE VARIANCE WORKSPACE"), title: bi("مقارنة تحديثات البرنامج", "Schedule update comparison"), description: "قارن برنامجين محددين من ملفاتك، ثم راجع فروق الأنشطة والمدة وتاريخ الإكمال. المقارنة فنية ولا تُقرر الاستحقاق التعاقدي بذاتها.",
    context: "تنزيل XER أدناه تبادلي وتجريبي: يُراجع في Primavera منفصل ولا يستبدل ملف المصدر.", useOpen: bi("استخدم البرنامج المفتوح كأساس", "Use the open schedule as baseline"), preXer: bi("تنزيل XER قبل TIA", "Download Pre-TIA XER"), postXer: bi("تنزيل XER بعد TIA", "Download Post-TIA XER"),
    baseline: bi("البرنامج المرجعي / السابق", "Baseline / previous schedule"), update: bi("تحديث البرنامج / اللاحق", "Update / later schedule"), notLoaded: bi("لم يُحمّل بعد", "Not loaded yet"), activities: bi("نشاط", "activities"), starts: bi("يبدأ", "starts"), support: "يدعم XER وP6 XML وJSON. لا تغادر الملفات المتصفح أثناء المقارنة.",
    loading: bi("جارِ القراءة…", "Reading…"), upload: bi("تحميل ملف", "Upload file"), remove: bi("إزالة", "Remove"), transfer: "قارن نفس نطاق المشروع قدر الإمكان", durationVariance: bi("فرق مدة المشروع", "Project duration variance"), changedActivities: bi("أنشطة مُعدّلة", "Changed activities"), scopeChanges: bi("تغييرات نطاق", "Scope changes"), from: bi("من أصل", "out of"), inUpdate: bi("نشاط في التحديث", "activities in the update"), added: bi("مضاف", "added"), removed: bi("محذوف", "removed"), days: bi("يوم", "days"),
    emptyTitle: bi("حمّل برنامجين لبدء المقارنة", "Load two schedules to start comparing"), emptyDescription: "اختر نسخة مرجعية ثم تحديثاً لنفس المشروع. يمكنك استخدام البرنامج المفتوح كأساس أو تحميل XER/XML/JSON.",
    loadSuccess: "تم تحميل", openSuccess: "حُمّل البرنامج المفتوح كبرنامج مرجعي.", genericReadError: "تعذر قراءة ملف البرنامج.", xerQualityBlocked: "أُوقف تنزيل XER: صحح موانع جودة البرنامج أولاً", xerRoundTripBlocked: "أُوقف تنزيل XER:", xerRoundTripFallback: "فشل فحص الاستيراد العكسي.", xerDownloadSuccess: "تم تنزيل", preTiaSnapshot: "قبل TIA", postTiaSnapshot: "بعد TIA", xerDownloaded: "التجريبي بعد فحص الاستيراد العكسي:", relationships: "علاقة", conjunction: "و", xerCreateError: "تعذر إنشاء ملف XER التجريبي.", xerReview: "راجِع قيود التقويم وحقول P6 غير المدعومة في رسالة التنزيل قبل استخدام الملف خارجياً.",
  };
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
      toast.success(`${tx.loadSuccess} ${slot === "baseline" ? tx.baseline : tx.update}: ${parsed.name}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : tx.genericReadError); }
    finally { setIsReading(null); }
  }

  function downloadXer(snapshot: "pre-tia" | "post-tia") {
    try {
      const source = snapshot === "post-tia" && selectedEvent ? insertFragnet(currentSchedule, selectedEvent) : currentSchedule;
      const quality = assessScheduleQuality(source);
      if (quality.exportReadiness === "blocked") {
        const reasons = quality.rules.filter((rule) => rule.severity === "blocker").map((rule) => rule.title).join("، ");
        toast.error(`${tx.xerQualityBlocked}${reasons ? ` (${reasons})` : ""}.`);
        return;
      }
      const output = exportExperimentalXer(source, snapshot);
      const roundTrip = validateExperimentalXerRoundTrip(output);
      if (roundTrip.state === "blocked") {
        toast.error(`${tx.xerRoundTripBlocked} ${roundTrip.messages[0] ?? tx.xerRoundTripFallback}`);
        return;
      }
      downloadText(output.fileName, output.content, "text/plain;charset=utf-8");
      toast.success(`${tx.xerDownloadSuccess} ${snapshot === "post-tia" ? tx.postTiaSnapshot : tx.preTiaSnapshot} ${tx.xerDownloaded} ${roundTrip.activityCount} ${tx.activities} ${tx.conjunction} ${roundTrip.relationshipCount} ${tx.relationships}.`);
      if (roundTrip.state === "review") toast.warning(tx.xerReview);
    } catch (error) { toast.error(error instanceof Error ? error.message : tx.xerCreateError); }
  }

  const slot = (kind: SourceSlot, title: string, value: Schedule | null, inputRef: RefObject<HTMLInputElement | null>) => <section className={`comparison-source ${value ? "is-ready" : ""}`}>
    <div className="comparison-source-head"><span className="comparison-step">{kind === "baseline" ? "01" : "02"}</span><div><p>{title}</p><b>{value?.name ?? tx.notLoaded}</b></div>{value ? <CheckCircle2 size={19} /> : <FileDiff size={19} />}</div>
    <small>{value ? `${value.activities.length} ${tx.activities} · ${tx.starts} ${value.startDate}` : tx.support}</small>
    <div className="comparison-source-actions"><Button variant="outline" size="sm" disabled={isReading !== null} onClick={() => inputRef.current?.click()}>{isReading === kind ? <LoaderCircle size={15} className="animate-spin" /> : <FileUp size={15} />}{isReading === kind ? tx.loading : tx.upload}</Button>{value ? <Button variant="ghost" size="sm" onClick={() => kind === "baseline" ? setBaseline(null) : setUpdate(null)}><Trash2 size={15} />{tx.remove}</Button> : null}</div>
    <input ref={inputRef} type="file" accept=".xer,.xml,.json,text/plain,application/json,text/xml" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(kind, file); event.currentTarget.value = ""; }} />
  </section>;

  return <div className="view-stack comparison-view" dir={direction}><section className="page-heading"><div><p className="eyebrow">{tx.eyebrow}</p><h1>{tx.title}</h1><p>{tx.description}</p><p className="context-tip">{tx.context}</p></div><div className="heading-actions"><Button variant="outline" className="outline-action" onClick={() => { setBaseline(currentSchedule); toast.success(tx.openSuccess); }}><Plus size={16} />{tx.useOpen}</Button><Button variant="outline" className="outline-action" onClick={() => downloadXer("pre-tia")}><Download size={16} />{tx.preXer}</Button>{selectedEvent ? <Button variant="outline" className="outline-action" onClick={() => downloadXer("post-tia")}><Download size={16} />{tx.postXer}</Button> : null}</div></section>
    <section className="comparison-workspace">{slot("baseline", tx.baseline, baseline, baselineRef)}<div className="comparison-transfer"><ArrowLeftRight size={22} /><span>{tx.transfer}</span></div>{slot("update", tx.update, update, updateRef)}</section>
    {comparison ? <><section className="comparison-kpis"><div><small>{tx.durationVariance}</small><b className={comparison.completionDeltaDays > 0 ? "is-delay" : comparison.completionDeltaDays < 0 ? "is-gain" : ""}>{comparison.completionDeltaDays > 0 ? "+" : ""}{comparison.completionDeltaDays} {tx.days}</b><span>{comparison.baseline.completionDate} ← {comparison.update.completionDate}</span></div><div><small>{tx.changedActivities}</small><b>{comparison.summary.changed}</b><span>{tx.from} {comparison.update.activityCount} {tx.inUpdate}</span></div><div><small>{tx.scopeChanges}</small><b>{comparison.summary.added + comparison.summary.removed}</b><span>{tx.added} {comparison.summary.added} · {tx.removed} {comparison.summary.removed}</span></div></section>
      {comparison.summary.warnings.length ? <section className="comparison-warnings">{comparison.summary.warnings.map((warning) => <div key={warning}><AlertTriangle size={17} /><span>{warning}</span></div>)}</section> : null}
      {baseline && update ? <GanttComparisonChart baseline={baseline} update={update} comparison={comparison} onExport={() => downloadText("tia-update-comparison.csv", comparisonToCsv(comparison), "text/csv;charset=utf-8")} /> : null}</> : <section className="comparison-empty"><FileDiff size={28} /><div><b>{tx.emptyTitle}</b><p>{tx.emptyDescription}</p></div></section>}</div>;
}
