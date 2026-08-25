import React, { useMemo, useState } from "react";
import { Download, Filter, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWorkingDays, runCPM, type ActivityMetrics, type Schedule } from "@/lib/cpm";
import type { ActivityVarianceStatus, ScheduleComparison } from "@/lib/schedule-comparison";
import { useAppLanguage } from "@/contexts/LanguageContext";
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

const zoomSteps = [4, 6, 9, 13];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function calendarDayOffset(from: string, to: string) {
  return Math.round((startOfUtcDay(to) - startOfUtcDay(from)) / DAY_MS);
}

function formatDate(value: string, language: "ar" | "en") {
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "ar-EG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
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
  const { language, direction } = useAppLanguage();
  const tx = language === "en" ? {
    eyebrow: "INTERACTIVE BASELINE / UPDATE TIMELINE", title: "Comparison timeline", description: "Each row shows the baseline layer in blue and the update in orange according to CPM output. Hatched shading denotes an activity that is critical in either version.", exportCsv: "Export CSV", filter: "Chart filters", status: "Activity status", all: "All", wbs: "WBS", filterByWbs: "Filter by WBS", allWbs: "All packages", reset: "Reset filters", zoomControls: "Chart zoom controls", scale: "Scale", zoomOut: "Zoom out", zoomIn: "Zoom in", baseline: "Baseline", update: "Update", delay: "Increase / delay", critical: "Critical", visible: "activities visible out of", scrollRegion: "Horizontally scrollable Gantt chart area", activityWbs: "Activity / WBS", unclassified: "Unclassified", days: "days", noResults: "No activities match the current filter. Reset filters to show all activities.", disclaimer: "Professional note: the chart displays date, duration, and calculated criticality variances. It does not by itself establish causation, entitlement to an extension, or compensation.",
    statuses: { unchanged: "Unchanged", changed: "Changed", added: "Added", removed: "Removed" } satisfies Record<ActivityVarianceStatus, string>,
    baselineTitle: "Baseline", updateTitle: "Update", through: "to",
  } : {
    eyebrow: "مخطط زمني تفاعلي: الأساس والتحديث", title: "المخطط الزمني المقارن", description: "كل صف يعرض طبقة الأساس بالأزرق والتحديث بالبرتقالي وفق مخرجات CPM. التظليل المخطط يدل على نشاط حرج في إحدى النسختين.", exportCsv: "تصدير CSV", filter: "تصفية المخطط", status: "حالة النشاط", all: "الكل", wbs: "WBS", filterByWbs: "تصفية حسب WBS", allWbs: "كل الحزم", reset: "إعادة ضبط", zoomControls: "التحكم في تكبير المخطط", scale: "المقياس", zoomOut: "تصغير المخطط", zoomIn: "تكبير المخطط", baseline: "الأساس", update: "التحديث", delay: "زيادة/تأخير", critical: "حرج", visible: "نشاط ظاهر من", scrollRegion: "منطقة مخطط Gantt قابلة للتمرير أفقياً", activityWbs: "النشاط / الحزمة", unclassified: "غير مصنّف", days: "يوم", noResults: "لا توجد أنشطة تطابق التصفية الحالية. أعد ضبط التصفية لعرض جميع الأنشطة.", disclaimer: "ملاحظة مهنية: يعرض المخطط فروق التواريخ والمدد والحرجية الحسابية، ولا يثبت بمفرده علاقة سببية أو استحقاق تمديد أو تعويض.",
    statuses: { unchanged: "دون تغيير", changed: "مُعدّل", added: "مضاف", removed: "محذوف" } satisfies Record<ActivityVarianceStatus, string>,
    baselineTitle: "الأساس", updateTitle: "التحديث", through: "حتى",
  };
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
        wbs: updateActivity?.wbs || baselineActivity?.wbs || tx.unclassified,
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
  }, [baseline, comparison.activityVariances, tx.unclassified, update]);

  const wbsValues = useMemo(() => Array.from(new Set(model.rows.map(row => row.wbs))).sort((a, b) => a.localeCompare(b, language === "en" ? "en" : "ar")), [language, model.rows]);
  const visibleRows = model.rows.filter(row => (statusFilter === "all" || row.status === statusFilter) && (wbsFilter === "all" || row.wbs === wbsFilter));
  const tickEvery = Math.max(1, Math.ceil(model.totalDays / 9));
  const ticks = Array.from({ length: Math.ceil(model.totalDays / tickEvery) + 1 }, (_, index) => index * tickEvery).filter(day => day <= model.totalDays);
  const laneWidth = Math.max(620, model.totalDays * pixelsPerDay + 36);

  const resetFilters = () => {
    setStatusFilter("all");
    setWbsFilter("all");
  };

  return <section className="panel gantt-comparison-panel" dir={direction} aria-label={tx.title}>
    <div className="panel-heading gantt-heading">
      <div>
        <p className="eyebrow">{tx.eyebrow}</p>
        <h2>{tx.title}</h2>
        <span>{tx.description}</span>
      </div>
      <div className="gantt-heading-actions">
        <Button variant="outline" size="sm" onClick={onExport}><Download size={15} />{tx.exportCsv}</Button>
      </div>
    </div>

    <div className="gantt-controls" dir={direction}>
      <div className="gantt-filter-group" aria-label={tx.filter}>
        <Filter size={15} aria-hidden="true" />
        <div className="gantt-status-filters" role="group" aria-label={tx.status}>
          <button type="button" className={statusFilter === "all" ? "selected" : ""} onClick={() => setStatusFilter("all")}>{tx.all}</button>
          {(Object.keys(tx.statuses) as ActivityVarianceStatus[]).map(status => <button key={status} type="button" className={statusFilter === status ? "selected" : ""} onClick={() => setStatusFilter(status)}>{tx.statuses[status]}</button>)}
        </div>
        <label className="gantt-wbs-select">
          <span>{tx.wbs}</span>
          <select value={wbsFilter} onChange={event => setWbsFilter(event.target.value)} aria-label={tx.filterByWbs}>
            <option value="all">{tx.allWbs}</option>
            {wbsValues.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button type="button" className="gantt-reset" onClick={resetFilters} aria-label={tx.reset}><RotateCcw size={14} />{tx.reset}</button>
      </div>
      <div className="gantt-zoom" aria-label={tx.zoomControls}>
        <span>{tx.scale}</span>
        <Button variant="outline" size="icon" aria-label={tx.zoomOut} disabled={zoomIndex === 0} onClick={() => setZoomIndex(current => Math.max(0, current - 1))}><Minus size={15} /></Button>
        <b>{pixelsPerDay}px/{tx.days}</b>
        <Button variant="outline" size="icon" aria-label={tx.zoomIn} disabled={zoomIndex === zoomSteps.length - 1} onClick={() => setZoomIndex(current => Math.min(zoomSteps.length - 1, current + 1))}><Plus size={15} /></Button>
      </div>
    </div>

    <div className="gantt-legend" dir={direction}><span><i className="gantt-legend-swatch baseline" />{tx.baseline}</span><span><i className="gantt-legend-swatch update" />{tx.update}</span><span><i className="gantt-legend-swatch delayed" />{tx.delay}</span><span><i className="gantt-legend-swatch critical" />{tx.critical}</span><b>{visibleRows.length} {tx.visible} {model.rows.length}</b></div>

    <div className="gantt-scroll" dir="ltr" data-testid="gantt-comparison-chart" tabIndex={0} aria-label={tx.scrollRegion}>
      <div className="gantt-grid" style={{ minWidth: `${laneWidth + 280}px`, gridTemplateColumns: `280px ${laneWidth}px` }}>
        <div className="gantt-activity-header" dir={direction}><span>{tx.activityWbs}</span><small>{formatDate(model.globalStart, language)} → {formatDate(addWorkingDays(model.globalStart, model.totalDays), language)}</small></div>
        <div className="gantt-axis" style={{ width: `${laneWidth}px` }} aria-hidden="true">
          {ticks.map(day => <span key={day} className="gantt-tick" style={{ left: `${Math.min(laneWidth - 1, day * pixelsPerDay)}px` }}><i />{formatDate(addWorkingDays(model.globalStart, day), language)}</span>)}
        </div>
        {visibleRows.map(row => {
          const id = safeId(row.id);
          const isDelayed = (row.durationDelta ?? 0) > 0;
          const isCritical = Boolean(row.baseline?.isCritical || row.update?.isCritical);
          return <div className="gantt-row" key={row.id} data-testid={`gantt-row-${id}`}>
            <div className="gantt-row-label" dir={direction}>
              <div><b dir="ltr">{row.id}</b><span title={row.name}>{row.name}</span></div>
              <small>{row.wbs}</small>
              <div className="gantt-row-tags"><em className={`gantt-status gantt-status--${row.status}`}>{tx.statuses[row.status]}</em>{isDelayed ? <em className="gantt-delay-tag">+{row.durationDelta} {tx.days}</em> : null}{isCritical ? <em className="gantt-critical-tag">{tx.critical}</em> : null}</div>
            </div>
            <div className="gantt-lane" style={{ width: `${laneWidth}px` }}>
              {ticks.map(day => <i key={day} className="gantt-guide" style={{ left: `${Math.min(laneWidth - 1, day * pixelsPerDay)}px` }} />)}
              {row.baseline ? <span data-testid={`gantt-bar-baseline-${id}`} className={`gantt-bar gantt-bar--baseline${row.baseline.isCritical ? " is-critical" : ""}`} style={{ left: `${row.baseline.offset * pixelsPerDay}px`, width: `${Math.max(5, row.baseline.span * pixelsPerDay)}px` }} title={`${tx.baselineTitle}: ${formatDate(row.baseline.startDate, language)} ${tx.through} ${formatDate(row.baseline.finishDate, language)} · ${row.baseline.duration} ${tx.days}`} /> : null}
              {row.update ? <span data-testid={`gantt-bar-update-${id}`} className={`gantt-bar gantt-bar--update${isDelayed ? " is-delayed" : ""}${row.update.isCritical ? " is-critical" : ""}`} style={{ left: `${row.update.offset * pixelsPerDay}px`, width: `${Math.max(5, row.update.span * pixelsPerDay)}px` }} title={`${tx.updateTitle}: ${formatDate(row.update.startDate, language)} ${tx.through} ${formatDate(row.update.finishDate, language)} · ${row.update.duration} ${tx.days}`} /> : null}
            </div>
          </div>;
        })}
      </div>
      {!visibleRows.length ? <div className="gantt-no-results" dir={direction}>{tx.noResults}</div> : null}
    </div>
    <p className="gantt-disclaimer">{tx.disclaimer}</p>
  </section>;
}
