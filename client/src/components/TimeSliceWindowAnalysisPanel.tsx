import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, CheckCircle2, GitCompareArrows, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { bilingualUiLabel } from "@/lib/language";
import { runTimeSliceWindowAnalysis, type TimeSliceSnapshot } from "@/lib/cpm";
import type { ScheduleSnapshot } from "./GuidedAnalysisPanel";

type Props = {
  baselineSnapshot: ScheduleSnapshot | null;
  updateSnapshots: ScheduleSnapshot[];
};

function snapshotDate(snapshot: ScheduleSnapshot) {
  return snapshot.schedule.dataDate ?? snapshot.schedule.startDate;
}

function changeLabel(
  language: ReturnType<typeof useAppLanguage>["language"],
  change: "added" | "removed" | "duration-changed" | "logic-changed" | "criticality-changed"
) {
  const labels = {
    added: ["نشاط مضاف", "Activity added"],
    removed: ["نشاط محذوف", "Activity removed"],
    "duration-changed": ["مدة متغيرة", "Duration changed"],
    "logic-changed": ["منطق متغير", "Logic changed"],
    "criticality-changed": ["حرجية متغيرة", "Criticality changed"],
  } as const;
  const [arabic, english] = labels[change];
  return bilingualUiLabel(language, arabic, english);
}

/**
 * Time Slice / Windows observational comparison.
 * It intentionally remains separate from runWindowTIA: no Fragnet is inserted,
 * no entitlement is inferred, and every source schedule remains read-only.
 */
export function TimeSliceWindowAnalysisPanel({ baselineSnapshot, updateSnapshots }: Props) {
  const { language, direction } = useAppLanguage();
  const snapshots = useMemo(
    () => [baselineSnapshot, ...updateSnapshots]
      .filter((item): item is ScheduleSnapshot => Boolean(item))
      .sort((left, right) => snapshotDate(left).localeCompare(snapshotDate(right))),
    [baselineSnapshot, updateSnapshots]
  );
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  useEffect(() => {
    if (snapshots.length < 2) {
      setFromId("");
      setToId("");
      return;
    }
    if (!snapshots.some((snapshot) => snapshot.id === fromId)) {
      setFromId(snapshots[0].id);
    }
    if (!snapshots.some((snapshot) => snapshot.id === toId) || toId === fromId) {
      setToId(snapshots[1].id);
    }
  }, [snapshots, fromId, toId]);

  const fromSnapshot = snapshots.find((snapshot) => snapshot.id === fromId) ?? null;
  const toSnapshot = snapshots.find((snapshot) => snapshot.id === toId) ?? null;
  const resultState = useMemo(() => {
    if (!fromSnapshot || !toSnapshot || fromSnapshot.id === toSnapshot.id) {
      return { result: null, error: "" };
    }
    try {
      const toTimeSliceSnapshot = (snapshot: ScheduleSnapshot): TimeSliceSnapshot => ({
        id: snapshot.id,
        label: snapshot.fileName,
        fileName: snapshot.fileName,
        schedule: snapshot.schedule,
      });
      return {
        result: runTimeSliceWindowAnalysis({
          id: `TS-${fromSnapshot.id}-${toSnapshot.id}`,
          name: `${fromSnapshot.fileName} → ${toSnapshot.fileName}`,
          fromSnapshot: toTimeSliceSnapshot(fromSnapshot),
          toSnapshot: toTimeSliceSnapshot(toSnapshot),
          status: "review",
        }),
        error: "",
      };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : bilingualUiLabel(language, "تعذر تنفيذ قراءة النافذة", "The time-slice review could not run") };
    }
  }, [fromSnapshot, toSnapshot, language]);

  const label = (arabic: string, english: string) => bilingualUiLabel(language, arabic, english);

  return (
    <section className="panel mt-5" dir={direction} data-testid="time-slice-window-panel">
      <div className="panel-heading gap-4">
        <div>
          <p className="eyebrow"><GitCompareArrows size={14} /> {label("قراءة نسخ متتابعة", "Sequential schedule review")}</p>
          <h2>{label("تحليل النوافذ الرصدي · Time Slice Window Analysis", "Time Slice Window Analysis")}</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {label(
              "يقارن نسختين محمّلتين من البرنامج كما وردتا من المصدر، ولا يدرج Fragnet ولا يغيّر ملفاتك.",
              "Compares two imported schedule versions as supplied; it does not insert a Fragnet or modify your files."
            )}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1.5">
          <CalendarRange size={14} /> {snapshots.length} {label("نسخة", "snapshot(s)")}
        </Badge>
      </div>

      {snapshots.length < 2 ? (
        <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>{label("يلزم Baseline وUpdate واحد على الأقل، أو نسختان متتابعتان محفوظتان من رحلة التحليل، قبل قراءة Time Slice.", "A Baseline plus at least one Update, or two retained sequential schedules, are required before a Time Slice can be reviewed.")}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <p className="text-sm font-medium">{label("النسخة الأولى", "Earlier snapshot")}</p>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger><SelectValue placeholder={label("اختر نسخة", "Choose a snapshot")} /></SelectTrigger>
                <SelectContent>
                  {snapshots.map((snapshot) => <SelectItem value={snapshot.id} key={snapshot.id}><span dir="ltr">{snapshot.fileName} · {snapshotDate(snapshot)}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{label("النسخة التالية", "Later snapshot")}</p>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger><SelectValue placeholder={label("اختر نسخة", "Choose a snapshot")} /></SelectTrigger>
                <SelectContent>
                  {snapshots.map((snapshot) => <SelectItem value={snapshot.id} key={snapshot.id} disabled={snapshot.id === fromId}><span dir="ltr">{snapshot.fileName} · {snapshotDate(snapshot)}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={() => { setFromId(snapshots[0]?.id ?? ""); setToId(snapshots[1]?.id ?? ""); }}>
              {label("استخدم الترتيب الزمني", "Use chronological order")}
            </Button>
          </div>

          {resultState.error ? (
            <div className="mt-4 flex gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-4 text-sm">
              <AlertTriangle className="mt-0.5 shrink-0 text-destructive" size={18} /><p>{resultState.error}</p>
            </div>
          ) : null}

          {resultState.result ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{label("فرق الإكمال", "Completion shift")}</p><b className="text-xl" dir="ltr">{resultState.result.completionShiftCalendarDays >= 0 ? "+" : ""}{resultState.result.completionShiftCalendarDays} d</b></div>
                <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{label("فرق أيام العمل", "Working-day shift")}</p><b className="text-xl" dir="ltr">{resultState.result.completionShiftWorkingDays === undefined ? "—" : `${resultState.result.completionShiftWorkingDays >= 0 ? "+" : ""}${resultState.result.completionShiftWorkingDays} d`}</b></div>
                <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{label("تغيّرات الأنشطة", "Activity changes")}</p><b className="text-xl" dir="ltr">{resultState.result.activityChanges.length}</b></div>
                <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{label("مقارنة التقويم", "Calendar comparison")}</p><b className="text-sm">{resultState.result.calendarsComparable ? label("متوافق", "Comparable") : label("يلزم مراجعة", "Review required")}</b></div>
              </div>

              <div className="rounded-lg border bg-muted/35 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><GitCompareArrows size={16} /> {label("سجل التغيّرات المرصودة", "Observed change register")}</div>
                {resultState.result.activityChanges.length ? <div className="space-y-2">{resultState.result.activityChanges.slice(0, 12).map((change) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm" key={`${change.activityId}-${change.change}`}><span dir="ltr" className="font-mono font-medium">{change.activityId}</span><Badge variant="secondary">{changeLabel(language, change.change)}</Badge><span dir="ltr" className="text-muted-foreground">{change.fromDuration ?? "—"} → {change.toDuration ?? "—"}</span></div>)}</div> : <p className="text-sm text-muted-foreground">{label("لم يرصد المقارن تغييراً في المدة أو المنطق أو الحالة الحرجة بحسب معرفات الأنشطة.", "No duration, logic, or criticality change was observed by activity ID.")}</p>}
              </div>

              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} /> {label("حدود القراءة الفنية", "Technical-review limits")}</div>
                {resultState.result.warnings.map((warning) => <p key={warning}>• {warning}</p>)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 size={15} /> {label("النتيجة تسجّل ما تغيّر بين نسختين؛ يبقى السبب والمسؤولية والاستحقاق خطوة مراجعة مستقلة بالأدلة والعقد.", "The result records what changed between two snapshots; causation, responsibility, and entitlement remain an evidence-and-contract review step.")}</div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
