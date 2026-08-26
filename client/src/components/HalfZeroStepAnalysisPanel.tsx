import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, FilePenLine, GitCompareArrows, Scale, ShieldCheck, SplitSquareVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { bilingualUiLabel } from "@/lib/language";
import {
  createUpdateToUpdatePair,
  inspectUpdateToUpdatePair,
  runHalfZeroStepAnalysis,
  type HalfZeroAnalystClassification,
  type UpdateToUpdateReadinessCheck,
} from "@/lib/update-to-update-analysis";
import type { ScheduleSnapshot } from "./GuidedAnalysisPanel";

type Props = {
  baselineSnapshot: ScheduleSnapshot | null;
  updateSnapshots: ScheduleSnapshot[];
  onAddDraft?: (payload: { draft: string; destination: "narrative" | "claim" }) => void;
};

type DraftDestination = "narrative" | "claim";

function snapshotDate(snapshot: ScheduleSnapshot) {
  return snapshot.schedule.dataDate ?? snapshot.schedule.startDate;
}

function statusTone(status: "pass" | "review" | "blocked") {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100";
  if (status === "review") return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100";
  return "border-destructive/35 bg-destructive/5 text-foreground";
}

function checkIcon(status: UpdateToUpdateReadinessCheck["status"]) {
  if (status === "pass") return <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />;
  if (status === "review") return <CircleAlert size={16} className="shrink-0 text-amber-600" />;
  return <AlertTriangle size={16} className="shrink-0 text-destructive" />;
}

function categoryLabel(language: "ar" | "en", category: string) {
  const labels: Record<string, readonly [string, string]> = {
    progress: ["تقدم/Actuals", "Progress / actuals"],
    "remaining-duration": ["مدة متبقية", "Remaining duration"],
    duration: ["مدة أصلية", "Original duration"],
    logic: ["علاقات/lag", "Logic / lag"],
    calendar: ["تقويم/عطلات", "Calendar / holidays"],
    constraint: ["قيود", "Constraints"],
    "scope-identity": ["نطاق/هوية نشاط", "Scope / activity identity"],
  };
  const item = labels[category] ?? [category, category];
  return bilingualUiLabel(language, item[0], item[1]);
}

function writeDraft(
  language: "ar" | "en",
  earlier: ScheduleSnapshot,
  later: ScheduleSnapshot,
  analysis: ReturnType<typeof runHalfZeroStepAnalysis>,
) {
  if (analysis.status !== "review-ready" || !analysis.halfPath || !analysis.zeroPath || !analysis.sensitivity) return "";
  const half = analysis.halfPath;
  const zero = analysis.zeroPath;
  const sensitivity = analysis.sensitivity;
  if (language === "en") {
    return `## Half–Zero Step Technical Review Draft\n\n**Comparison pair.** ${earlier.fileName} (${snapshotDate(earlier)}) was compared with ${later.fileName} (${snapshotDate(later)}) using the local A/H/Z/B review states.\n\n**Half path.** Net completion movement was ${half.netDays >= 0 ? "+" : ""}${half.netDays} calendar days. The interim progress-state movement (A→H) was ${half.firstDays >= 0 ? "+" : ""}${half.firstDays} days and the subsequent plan-revision movement (H→B) was ${half.secondDays >= 0 ? "+" : ""}${half.secondDays} days. Reconciliation residual: ${half.residualDays} days.\n\n**Zero path.** The initial plan-revision movement (A→Z) was ${zero.firstDays >= 0 ? "+" : ""}${zero.firstDays} days and the subsequent progress-state movement (Z→B) was ${zero.secondDays >= 0 ? "+" : ""}${zero.secondDays} days. Reconciliation residual: ${zero.residualDays} days.\n\n**Sensitivity disclosure.** ${sensitivity.disclosure.en} The progress allocation difference between paths is ${sensitivity.progressAllocationDifferenceDays >= 0 ? "+" : ""}${sensitivity.progressAllocationDifferenceDays} days; the revision allocation difference is ${sensitivity.revisionAllocationDifferenceDays >= 0 ? "+" : ""}${sensitivity.revisionAllocationDifferenceDays} days.\n\n**Technical limitation.** This is a reviewable local CPM reading of supplied updates. It is not a decision on causation, responsibility, EOT, entitlement, cost, or legal concurrency. Reconcile the selected consecutive updates in a non-production Primavera P6 copy before reliance.`;
  }
  return `## مسودة مراجعة فنية — Half–Zero Step\n\n**زوج المقارنة.** تمت مقارنة ${earlier.fileName} (${snapshotDate(earlier)}) مع ${later.fileName} (${snapshotDate(later)}) عبر حالات A/H/Z/B المحلية.\n\n**مسار Half.** فرق الإكمال الصافي ${half.netDays >= 0 ? "+" : ""}${half.netDays} يوم تقويمي. فرق حالة التقدم الوسيطة (A→H) ${half.firstDays >= 0 ? "+" : ""}${half.firstDays} يوم، ثم فرق تعديل الخطة (H→B) ${half.secondDays >= 0 ? "+" : ""}${half.secondDays} يوم. متبقي التسوية: ${half.residualDays} يوم.\n\n**مسار Zero.** فرق تعديل الخطة أولاً (A→Z) ${zero.firstDays >= 0 ? "+" : ""}${zero.firstDays} يوم، ثم فرق حالة التقدم (Z→B) ${zero.secondDays >= 0 ? "+" : ""}${zero.secondDays} يوم. متبقي التسوية: ${zero.residualDays} يوم.\n\n**إفصاح الحساسية.** ${sensitivity.disclosure.ar} فرق توزيع التقدم بين المسارين ${sensitivity.progressAllocationDifferenceDays >= 0 ? "+" : ""}${sensitivity.progressAllocationDifferenceDays} يوم، وفرق توزيع تعديل الخطة ${sensitivity.revisionAllocationDifferenceDays >= 0 ? "+" : ""}${sensitivity.revisionAllocationDifferenceDays} يوم.\n\n**حد فني.** هذه قراءة CPM محلية قابلة للمراجعة للـUpdates المقدمة، وليست قراراً للسبب أو المسؤولية أو EOT أو الاستحقاق أو التكلفة أو التزامن القانوني. يجب مطابقة زوج التحديثات المتتالي داخل نسخة Primavera P6 غير إنتاجية قبل الاعتماد.`;
}

/**
 * Half–Zero Step review layer. It consumes retained snapshots only and deliberately
 * remains separate from both Windowed TIA (modeled Fragnets) and Time Slice (observational changes).
 */
export function HalfZeroStepAnalysisPanel({ baselineSnapshot, updateSnapshots, onAddDraft }: Props) {
  const { language, direction } = useAppLanguage();
  const label = (arabic: string, english: string) => bilingualUiLabel(language, arabic, english);
  const snapshots = useMemo(
    () => [baselineSnapshot, ...updateSnapshots]
      .filter((item): item is ScheduleSnapshot => Boolean(item))
      .sort((left, right) => snapshotDate(left).localeCompare(snapshotDate(right))),
    [baselineSnapshot, updateSnapshots],
  );
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [classifications, setClassifications] = useState<Record<string, HalfZeroAnalystClassification>>({});

  useEffect(() => {
    if (snapshots.length < 2) {
      setFromId("");
      setToId("");
      return;
    }
    if (!snapshots.some((snapshot) => snapshot.id === fromId)) setFromId(snapshots[0].id);
    if (!snapshots.some((snapshot) => snapshot.id === toId) || toId === fromId) setToId(snapshots[1].id);
  }, [snapshots, fromId, toId]);

  const earlier = snapshots.find((snapshot) => snapshot.id === fromId) ?? null;
  const later = snapshots.find((snapshot) => snapshot.id === toId) ?? null;
  const result = useMemo(() => {
    if (!earlier || !later || earlier.id === later.id) return { analysis: null, inspection: null, error: "" };
    try {
      const pair = createUpdateToUpdatePair({
        id: `HZ-${earlier.id}-${later.id}`,
        previous: { id: earlier.id, label: earlier.fileName, fileName: earlier.fileName, schedule: earlier.schedule },
        current: { id: later.id, label: later.fileName, fileName: later.fileName, schedule: later.schedule },
      });
      return { analysis: runHalfZeroStepAnalysis(pair, { analystClassifications: classifications }), inspection: inspectUpdateToUpdatePair(pair), error: "" };
    } catch (error) {
      return { analysis: null, inspection: null, error: error instanceof Error ? error.message : label("تعذر إعداد زوج المقارنة", "The comparison pair could not be prepared") };
    }
  }, [earlier, later, classifications, language]);

  const needsClassification = result.inspection?.changeRegister.changes.filter((change) => change.classification === "needs-analyst-review") ?? [];
  const analysis = result.analysis;
  const completionCards = analysis?.states ? Object.values(analysis.states) : [];

  return (
    <section className="panel mt-5" dir={direction} data-testid="half-zero-step-panel">
      <div className="panel-heading gap-4">
        <div>
          <p className="eyebrow"><SplitSquareVertical size={14} /> {label("قراءة تفسيرية بين تحديثين", "Interpretive update-to-update review")}</p>
          <h2>{label("تحليل Half–Zero Step · مراجعة فقط", "Half–Zero Step Analysis · Review only")}</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {label("يبني حالات A/H/Z/B من النسخ المحلية فقط لفصل أثر التقدم المسجل عن أثر تعديل الخطة بصورة قابلة للمراجعة. لا يدرج Fragnet ولا يستبدل Windowed TIA أو Time Slice.", "Builds local A/H/Z/B states to review recorded-progress and plan-revision movements separately. It inserts no Fragnet and does not replace Windowed TIA or Time Slice.")}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1.5"><GitCompareArrows size={14} /> {snapshots.length} {label("نسخة", "snapshot(s)")}</Badge>
      </div>

      {snapshots.length < 2 ? (
        <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>{label("يلزم اختيار نسختين متتابعتين محفوظتين، لكل منهما Data Date وتقدم قابل للمراجعة، قبل تشغيل Half–Zero.", "Two retained consecutive snapshots with Data Dates and reviewable progress are required before Half–Zero can run.")}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2"><p className="text-sm font-medium">{label("التحديث السابق · Previous", "Previous update")}</p><Select value={fromId} onValueChange={(value) => { setFromId(value); setClassifications({}); }}><SelectTrigger><SelectValue placeholder={label("اختر نسخة", "Choose a snapshot")} /></SelectTrigger><SelectContent>{snapshots.map((snapshot) => <SelectItem value={snapshot.id} key={snapshot.id}><span dir="ltr">{snapshot.fileName} · {snapshotDate(snapshot)}</span></SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><p className="text-sm font-medium">{label("التحديث الحالي · Current", "Current update")}</p><Select value={toId} onValueChange={(value) => { setToId(value); setClassifications({}); }}><SelectTrigger><SelectValue placeholder={label("اختر نسخة", "Choose a snapshot")} /></SelectTrigger><SelectContent>{snapshots.map((snapshot) => <SelectItem value={snapshot.id} key={snapshot.id} disabled={snapshot.id === fromId}><span dir="ltr">{snapshot.fileName} · {snapshotDate(snapshot)}</span></SelectItem>)}</SelectContent></Select></div>
            <Button type="button" variant="outline" onClick={() => { setFromId(snapshots[0]?.id ?? ""); setToId(snapshots[1]?.id ?? ""); setClassifications({}); }}>{label("استخدم الترتيب الزمني", "Use chronological order")}</Button>
          </div>

          {result.error ? <div className="mt-4 flex gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-4 text-sm"><AlertTriangle className="mt-0.5 shrink-0 text-destructive" size={18} /><p>{result.error}</p></div> : null}

          {result.inspection ? <div className="mt-5 space-y-4">
            <div className="rounded-lg border bg-muted/25 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} /> {label("بوابة الجاهزية", "Readiness gate")}</div><Badge variant={result.inspection.readiness.status === "blocked" ? "destructive" : result.inspection.readiness.status === "ready-with-review" ? "secondary" : "outline"}>{result.inspection.readiness.status === "blocked" ? label("موقوف", "Blocked") : result.inspection.readiness.status === "ready-with-review" ? label("جاهز مع مراجعة", "Ready with review") : label("جاهز", "Ready")}</Badge></div>
              <div className="grid gap-2 lg:grid-cols-2">{result.inspection.readiness.checks.map((check) => <div className={`rounded-md border p-3 text-sm ${statusTone(check.status)}`} key={check.code}><div className="flex items-start gap-2">{checkIcon(check.status)}<div><b>{language === "ar" ? check.message.ar : check.message.en}</b>{check.details?.map((detail) => <p className="mt-1 text-xs opacity-80" key={detail.en}>{language === "ar" ? detail.ar : detail.en}</p>)}</div></div></div>)}</div>
            </div>

            {needsClassification.length ? <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/25">
              <div className="flex items-start gap-2"><Scale className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" size={18} /><div><p className="font-semibold text-sm">{label("تأكيد محلل مطلوب قبل التوزيع", "Analyst confirmation required before allocation")}</p><p className="mt-1 text-xs text-muted-foreground">{label("هذا التأكيد لا يحدد المسؤولية؛ هو فقط يمنع المحرك من تخمين توزيع فرق المدة بين التقدم وتعديل البرنامج.", "This confirmation does not determine responsibility; it only prevents the engine from guessing how to allocate a duration variance between progress and revision.")}</p></div></div>
              <div className="mt-3 space-y-2">{needsClassification.map((change) => { const key = `${change.activityId ?? "schedule"}:${change.category}`; return <div className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[1fr_12rem] sm:items-center" key={key}><div><div className="flex flex-wrap gap-2"><Badge variant="secondary">{categoryLabel(language, change.category)}</Badge>{change.activityId ? <span className="font-mono text-xs" dir="ltr">{change.activityId}</span> : null}</div><p className="mt-1 text-xs text-muted-foreground">{language === "ar" ? change.summary.ar : change.summary.en}</p></div><Select value={classifications[key] ?? "unclassified"} onValueChange={(value) => { if (value === "unclassified") { setClassifications((previous) => { const next = { ...previous }; delete next[key]; return next; }); } else { setClassifications((previous) => ({ ...previous, [key]: value as HalfZeroAnalystClassification })); } }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unclassified">{label("غير مصنف", "Unclassified")}</SelectItem><SelectItem value="progress">{label("تقدم مسجل · Progress", "Recorded progress")}</SelectItem><SelectItem value="revision">{label("تعديل خطة · Revision", "Plan revision")}</SelectItem></SelectContent></Select></div>; })}</div>
            </div> : null}

            {analysis?.status === "blocked" ? <div className="rounded-lg border border-destructive/35 bg-destructive/5 p-4 text-sm"><div className="flex gap-2 font-semibold"><AlertTriangle size={17} className="shrink-0 text-destructive" />{label("لم يُنتج توزيع Half–Zero", "No Half–Zero allocation was produced")}</div><div className="mt-2 space-y-1 text-muted-foreground">{analysis.blockingReasons.map((reason) => <p key={reason.en}>• {language === "ar" ? reason.ar : reason.en}</p>)}</div></div> : null}

            {analysis?.status === "review-ready" && analysis.states && analysis.halfPath && analysis.zeroPath && analysis.sensitivity ? <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{completionCards.map((state) => <div className="rounded-lg border bg-card p-3" key={state.key}><div className="flex items-center justify-between"><Badge variant="outline">{state.key}</Badge><span className="text-xs text-muted-foreground">{state.planSource === "previous" ? label("خطة سابقة", "Previous plan") : label("خطة حالية", "Current plan")}</span></div><p className="mt-2 text-xs text-muted-foreground">{language === "ar" ? state.title.ar : state.title.en}</p><b className="mt-1 block text-lg" dir="ltr">{state.completionDate}</b></div>)}</div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border bg-card p-4"><h3 className="font-semibold">{label("مسار Half · A → H → B", "Half path · A → H → B")}</h3><p className="mt-2 text-sm text-muted-foreground">{label("تقدم مسجل", "Recorded progress")}: <b dir="ltr">{analysis.halfPath.firstDays >= 0 ? "+" : ""}{analysis.halfPath.firstDays} d</b> · {label("تعديل خطة", "Plan revision")}: <b dir="ltr">{analysis.halfPath.secondDays >= 0 ? "+" : ""}{analysis.halfPath.secondDays} d</b></p><p className="mt-2 text-sm">{label("الصافي", "Net")}: <b dir="ltr">{analysis.halfPath.netDays >= 0 ? "+" : ""}{analysis.halfPath.netDays} d</b> · {label("تسوية", "Reconciliation")}: <b dir="ltr">{analysis.halfPath.residualDays} d</b></p></div>
                <div className="rounded-lg border bg-card p-4"><h3 className="font-semibold">{label("مسار Zero · A → Z → B", "Zero path · A → Z → B")}</h3><p className="mt-2 text-sm text-muted-foreground">{label("تعديل خطة", "Plan revision")}: <b dir="ltr">{analysis.zeroPath.firstDays >= 0 ? "+" : ""}{analysis.zeroPath.firstDays} d</b> · {label("تقدم مسجل", "Recorded progress")}: <b dir="ltr">{analysis.zeroPath.secondDays >= 0 ? "+" : ""}{analysis.zeroPath.secondDays} d</b></p><p className="mt-2 text-sm">{label("الصافي", "Net")}: <b dir="ltr">{analysis.zeroPath.netDays >= 0 ? "+" : ""}{analysis.zeroPath.netDays} d</b> · {label("تسوية", "Reconciliation")}: <b dir="ltr">{analysis.zeroPath.residualDays} d</b></p></div>
              </div>
              <div className={`rounded-lg border p-4 text-sm ${analysis.sensitivity.hasOrderSensitivity ? "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100" : "bg-muted/30"}`}><div className="flex gap-2 font-semibold"><Scale size={17} /> {label("حساسية الترتيب / Interaction", "Order sensitivity / interaction")}</div><p className="mt-2">{language === "ar" ? analysis.sensitivity.disclosure.ar : analysis.sensitivity.disclosure.en}</p><p className="mt-2 text-xs opacity-80">{label("فرق توزيع التقدم", "Progress allocation difference")}: <span dir="ltr">{analysis.sensitivity.progressAllocationDifferenceDays >= 0 ? "+" : ""}{analysis.sensitivity.progressAllocationDifferenceDays} d</span> · {label("فرق توزيع التعديل", "Revision allocation difference")}: <span dir="ltr">{analysis.sensitivity.revisionAllocationDifferenceDays >= 0 ? "+" : ""}{analysis.sensitivity.revisionAllocationDifferenceDays} d</span></p></div>
              {onAddDraft && earlier && later ? <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => onAddDraft({ destination: "narrative", draft: writeDraft(language, earlier, later, analysis) })}><FilePenLine size={16} /> {label("أضف مسودة إلى الـNarrative", "Add draft to Narrative")}</Button><Button type="button" variant="outline" onClick={() => onAddDraft({ destination: "claim", draft: writeDraft(language, earlier, later, analysis) })}><FilePenLine size={16} /> {label("أضف مسودة إلى الـClaim", "Add draft to Claim")}</Button></div> : null}
            </> : null}

            {analysis ? <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100"><div className="flex items-center gap-2 font-semibold text-sm"><ShieldCheck size={16} /> {label("حدود المراجعة الفنية", "Technical-review limits")}</div>{analysis.limitations.map((limitation) => <p key={limitation.en}>• {language === "ar" ? limitation.ar : limitation.en}</p>)}</div> : null}
          </div> : null}
        </>
      )}
    </section>
  );
}
