import React, { useMemo, useState } from "react";
import { Download, Filter, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWorkingDays, runCPM, type ActivityMetrics, type Schedule } from "@/lib/cpm";
import type { ActivityVarianceStatus, ScheduleComparison } from "@/lib/schedule-comparison";
import "./gantt-comparison.css";

type GanttComparisonChartProps = {
  baseline: Schedule;
  update: Schedule;
  comparison: ScheduleComparison;
  onExport: () => void;
};

type TimelineLayer = {
  offset: number;
  span: number;
  startDate: string;
  finishDate: string;
  duration: number;
  isCritical: boolean;
};

type GanttRow = {
  id: string;
  name: string;
  wbs: string;
  status: ActivityVarianceStatus;
  durationDelta: number | null;
  notes: string[];
  baseline?: TimelineLayer;
  update?: TimelineLayer;
};

const statusLabel: Record<ActivityVarianceStatus, string> = {
  unchanged: "دون تغيير",
  changed: "مُعدّل",
  added: "مضاف",
  removed: "محذوف",
};

const zoomSteps = [4, 6, 9, 13];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function calendarDayOffset(from: string, to: string) {
  return Math.round((startOfUtcDay(to) - startOfUtcDay(from)) / DAY_MS);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildLayer(metric: ActivityMetrics | undefined, schedule: Schedule, globalStart: string): TimelineLayer | undefined {
  if (!metric) return undefined;
  const startDate = addWorkingDays(schedule.startDate, metric.earlyStart, schedule.calendar);
  const finishDate = addWorkingDays(schedule.startDate, metric.earlyFinish, schedule.calendar);
  return {
    offset: Math.max(0, calendarDayOffset(globalStart, startDate)),
    span: Math.max(1, calendarDayOffset(startDate, finishDate)),
    startDate,
    finishDate,
    duration: metric.duration,
    isCritical: metric.isCritical,
  };
}

/** طبقتا Gantt تنقلان نتيجة CPM نفسها ولا تستنتجان أي استحقاق تعاقدي. */
export function GanttComparisonChart({ baseline, update, comparison, onExport }: GanttComparisonChartProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | ActivityVarianceStatus>("all");
  const [wbsFilter, setWbsFilter] = useState("all");
  const [zoomIndex, setZoomIndex] = useState(1);
  const pixelsPerDay = zoomSteps[zoomIndex];

  const model = useMemo(() => {
    const baselineCpm = runCPM(baseline);
    const updateCpm = runCPM(update);
    const globalStart = baseline.startDate <= update.startDate ? baseline.startDate : update.startDate;
    const baselineById = new Map(baselineCpm.activities.map(activity => [activity.id, activity]));
    const updateById = new Map(updateCpm.activities.map(activity => [activity.id, activity]));
    const rows: GanttRow[] = comparison.activityVariances.map(variance => {
      const baselineActivity = baselineById.get(variance.id);
      const updateActivity = updateById.get(variance.id);
      return {
        id: variance.id,
        name: variance.name,
        wbs: updateActivity?.wbs || baselineActivity?.wbs || "غير مصنّف",
        status: variance.status,
        durationDelta: variance.durationDelta,
        notes: variance.notes,
        baseline: buildLayer(baselineActivity, baseline, globalStart),
        update: buildLayer(updateActivity, update, globalStart),
      };
    });
    const finalOffset = Math.max(1, ...rows.flatMap(row => [
      row.baseline ? row.baseline.offset + row.baseline.span : 0,
      row.update ? row.update.offset + row.update.span : 0,
    ]));
    return { globalStart, rows, totalDays: finalOffset };
  }, [baseline, comparison.activityVariances, update]);

  const wbsValues = useMemo(() => Array.from(new Set(model.rows.map(row => row.wbs))).sort((a, b) => a.localeCompare(b, "ar")), [model.rows]);
  const visibleRows = model.rows.filter(row => (statusFilter === "all" || row.status === statusFilter) && (wbsFilter === "all" || row.wbs === wbsFilter));
  const tickEvery = Math.max(1, Math.ceil(model.totalDays / 9));
  const ticks = Array.from({ length: Math.ceil(model.totalDays / tickEvery) + 1 }, (_, index) => index * tickEvery).filter(day => day <= model.totalDays);
  const laneWidth = Math.max(620, model.totalDays * pixelsPerDay + 36);

  const resetFilters = () => {
    setStatusFilter("all");
    setWbsFilter("all");
  };

  return <section className="panel gantt-comparison-panel" aria-label="المخطط الزمني المقارن">
    <div className="panel-heading gantt-heading">
      <div>
        <p className="eyebrow">INTERACTIVE BASELINE / UPDATE TIMELINE</p>
        <h2>المخطط الزمني المقارن</h2>
        <span>كل صف يعرض طبقة الأساس بالأزرق والتحديث بالبرتقالي وفق مخرجات CPM. التظليل المخطط يدل على نشاط حرج في إحدى النسختين.</span>
      </div>
      <div className="gantt-heading-actions">
        <Button variant="outline" size="sm" onClick={onExport}><Download size={15} />تصدير CSV</Button>
      </div>
    </div>

    <div className="gantt-controls" dir="rtl">
      <div className="gantt-filter-group" aria-label="تصفية المخطط">
        <Filter size={15} aria-hidden="true" />
        <div className="gantt-status-filters" role="group" aria-label="حالة النشاط">
          <button type="button" className={statusFilter === "all" ? "selected" : ""} onClick={() => setStatusFilter("all")}>الكل</button>
          {(Object.keys(statusLabel) as ActivityVarianceStatus[]).map(status => <button key={status} type="button" className={statusFilter === status ? "selected" : ""} onClick={() => setStatusFilter(status)}>{statusLabel[status]}</button>)}
        </div>
        <label className="gantt-wbs-select">
          <span>WBS</span>
          <select value={wbsFilter} onChange={event => setWbsFilter(event.target.value)} aria-label="تصفية حسب WBS">
            <option value="all">كل الحزم</option>
            {wbsValues.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button type="button" className="gantt-reset" onClick={resetFilters} aria-label="إعادة ضبط التصفية"><RotateCcw size={14} />إعادة ضبط</button>
      </div>
      <div className="gantt-zoom" aria-label="التحكم في تكبير المخطط">
        <span>المقياس</span>
        <Button variant="outline" size="icon" aria-label="تصغير المخطط" disabled={zoomIndex === 0} onClick={() => setZoomIndex(current => Math.max(0, current - 1))}><Minus size={15} /></Button>
        <b>{pixelsPerDay}px/يوم</b>
        <Button variant="outline" size="icon" aria-label="تكبير المخطط" disabled={zoomIndex === zoomSteps.length - 1} onClick={() => setZoomIndex(current => Math.min(zoomSteps.length - 1, current + 1))}><Plus size={15} /></Button>
      </div>
    </div>

    <div className="gantt-legend" dir="rtl"><span><i className="gantt-legend-swatch baseline" />الأساس</span><span><i className="gantt-legend-swatch update" />التحديث</span><span><i className="gantt-legend-swatch delayed" />زيادة/تأخير</span><span><i className="gantt-legend-swatch critical" />نشاط حرج</span><b>{visibleRows.length} نشاط ظاهر من {model.rows.length}</b></div>

    <div className="gantt-scroll" dir="ltr" data-testid="gantt-comparison-chart" tabIndex={0} aria-label="منطقة مخطط Gantt قابلة للتمرير أفقياً">
      <div className="gantt-grid" style={{ minWidth: `${laneWidth + 280}px`, gridTemplateColumns: `280px ${laneWidth}px` }}>
        <div className="gantt-activity-header" dir="rtl"><span>النشاط / الحزمة</span><small>{formatDate(model.globalStart)} → {formatDate(addWorkingDays(model.globalStart, model.totalDays))}</small></div>
        <div className="gantt-axis" style={{ width: `${laneWidth}px` }} aria-hidden="true">
          {ticks.map(day => <span key={day} className="gantt-tick" style={{ left: `${Math.min(laneWidth - 1, day * pixelsPerDay)}px` }}><i />{formatDate(addWorkingDays(model.globalStart, day))}</span>)}
        </div>
        {visibleRows.map(row => {
          const id = safeId(row.id);
          const isDelayed = (row.durationDelta ?? 0) > 0;
          const isCritical = Boolean(row.baseline?.isCritical || row.update?.isCritical);
          return <div className="gantt-row" key={row.id} data-testid={`gantt-row-${id}`}>
            <div className="gantt-row-label" dir="rtl">
              <div><b dir="ltr">{row.id}</b><span title={row.name}>{row.name}</span></div>
              <small>{row.wbs}</small>
              <div className="gantt-row-tags"><em className={`gantt-status gantt-status--${row.status}`}>{statusLabel[row.status]}</em>{isDelayed ? <em className="gantt-delay-tag">+{row.durationDelta} يوم</em> : null}{isCritical ? <em className="gantt-critical-tag">حرج</em> : null}</div>
            </div>
            <div className="gantt-lane" style={{ width: `${laneWidth}px` }}>
              {ticks.map(day => <i key={day} className="gantt-guide" style={{ left: `${Math.min(laneWidth - 1, day * pixelsPerDay)}px` }} />)}
              {row.baseline ? <span data-testid={`gantt-bar-baseline-${id}`} className={`gantt-bar gantt-bar--baseline${row.baseline.isCritical ? " is-critical" : ""}`} style={{ left: `${row.baseline.offset * pixelsPerDay}px`, width: `${Math.max(5, row.baseline.span * pixelsPerDay)}px` }} title={`الأساس: ${formatDate(row.baseline.startDate)} حتى ${formatDate(row.baseline.finishDate)} · ${row.baseline.duration} يوم`} /> : null}
              {row.update ? <span data-testid={`gantt-bar-update-${id}`} className={`gantt-bar gantt-bar--update${isDelayed ? " is-delayed" : ""}${row.update.isCritical ? " is-critical" : ""}`} style={{ left: `${row.update.offset * pixelsPerDay}px`, width: `${Math.max(5, row.update.span * pixelsPerDay)}px` }} title={`التحديث: ${formatDate(row.update.startDate)} حتى ${formatDate(row.update.finishDate)} · ${row.update.duration} يوم`} /> : null}
            </div>
          </div>;
        })}
      </div>
      {!visibleRows.length ? <div className="gantt-no-results" dir="rtl">لا توجد أنشطة تطابق التصفية الحالية. أعد ضبط التصفية لعرض جميع الأنشطة.</div> : null}
    </div>
    <p className="gantt-disclaimer">ملاحظة مهنية: يعرض المخطط فروق التواريخ والمدد والحرجية الحسابية، ولا يثبت بمفرده علاقة سببية أو استحقاق تمديد أو تعويض.</p>
  </section>;
}
