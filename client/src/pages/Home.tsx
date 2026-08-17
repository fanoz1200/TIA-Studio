/**
 * TIA Studio — غرفة التحكم المعمارية
 * Blueprint blue, deliberate editorial spacing, and the orange fragnet layer
 * keep the analytical evidence more prominent than the interface chrome.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GitBranch,
  Info,
  LayoutDashboard,
  Network,
  Play,
  Plus,
  Printer,
  Route,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  dateToRelativeDay,
  runCPM,
  runTIA,
  type Activity,
  type CpmResult,
  type Fragnet,
  type Relationship,
  type RelationshipType,
  type Schedule,
  type TiaResult,
} from "@/lib/cpm";

const logoUrl = "/manus-storage/tia-studio-symbol_a5a70021.png";
const workspaceImageUrl = "/manus-storage/tia-studio-workspace-hero_f79d49ba.png";
const reportTextureUrl = "/manus-storage/tia-studio-report-texture_0415e3ef.png";

type ViewKey = "overview" | "schedule" | "event" | "analysis" | "report";
type CsvActivity = Activity;

const baseSchedule: Schedule = {
  id: "baseline-building-envelope",
  name: "برج النخيل — تحديث البرنامج رقم 04",
  startDate: "2026-01-05",
  dataDate: "2026-01-17",
  activities: [
    { id: "A100", name: "التجهيزات والتعبئة", duration: 5, wbs: "1.1", owner: "المقاول", plannedStart: 0 },
    { id: "A200", name: "أعمال الأساسات", duration: 8, wbs: "1.2", owner: "المقاول" },
    { id: "A300", name: "الهيكل الخرساني", duration: 10, wbs: "1.3", owner: "المقاول" },
    { id: "A400", name: "واجهة المبنى", duration: 7, wbs: "1.4", owner: "المقاول" },
    { id: "B100", name: "توريد التجهيزات", duration: 5, wbs: "2.1", owner: "المقاول", plannedStart: 0 },
    { id: "B200", name: "تركيب التجهيزات", duration: 5, wbs: "2.2", owner: "المقاول" },
  ],
  relationships: [
    { id: "R1", predecessorId: "A100", successorId: "A200", type: "FS" },
    { id: "R2", predecessorId: "A200", successorId: "A300", type: "FS" },
    { id: "R3", predecessorId: "A300", successorId: "A400", type: "FS" },
    { id: "R4", predecessorId: "B100", successorId: "B200", type: "FS" },
  ],
};

const initialEvent: Fragnet = {
  id: "EV-001",
  title: "تأخر اعتماد الرسومات المعدلة",
  description: "مدة مراجعة وإصدار رسومات هيكلية إضافية مطلوبة قبل بدء أعمال الواجهة.",
  cause: "employer",
  occurrenceDate: "2026-01-20",
  activities: [{ id: "FR-001", name: "مراجعة واعتماد الرسومات المعدلة", duration: 6, wbs: "CO-01", owner: "صاحب العمل", kind: "fragnet" }],
  relationships: [
    { id: "FR-R1", predecessorId: "A300", successorId: "FR-001", type: "FS" },
    { id: "FR-R2", predecessorId: "FR-001", successorId: "A400", type: "FS" },
  ],
  replacedRelationshipIds: ["R3"],
};

const navItems: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "لوحة التحكم", icon: LayoutDashboard },
  { key: "schedule", label: "البرنامج المعتمد", icon: Network },
  { key: "event", label: "حدث التأخير", icon: Zap },
  { key: "analysis", label: "نتيجة التحليل", icon: BarChart3 },
  { key: "report", label: "تقرير TIA", icon: FileText },
];

const causeLabel: Record<Fragnet["cause"], string> = {
  employer: "صاحب العمل",
  contractor: "المقاول",
  neutral: "محايد / قوة قاهرة",
  concurrent: "متزامن",
};

function tryRestore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function parseCsv(raw: string) {
  const rows: string[][] = [];
  let value = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const next = raw[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error("ملف CSV يحتاج صف عناوين وصف بيانات واحد على الأقل.");
  const headers = rows[0].map((header) => header.toLowerCase().replace(/\s+/g, ""));
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function downloadText(name: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dateLabel(date: string) {
  try {
    return new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`),
    );
  } catch {
    return date;
  }
}

function activityName(schedule: Schedule, id: string) {
  return schedule.activities.find((activity) => activity.id === id)?.name ?? id;
}

function MetricCard({ label, value, helper, tone = "blue", featured = false }: { label: string; value: string; helper: string; tone?: "blue" | "orange" | "green" | "graphite"; featured?: boolean }) {
  return (
    <div className={`metric-card metric-card--${tone} ${featured ? "metric-card--featured" : ""}`}>
      <p>{label}</p>
      <strong dir="ltr">{value}</strong>
      <span>{helper}</span>
    </div>
  );
}

function StatusBadge({ result }: { result: TiaResult | null }) {
  if (!result) return <Badge className="badge-muted">غير محسوب</Badge>;
  if (result.outcome === "delayed") return <Badge className="badge-delay">أثر حرج على الإكمال</Badge>;
  if (result.outcome === "float-consumed") return <Badge className="badge-float">استهلاك عائمة فقط</Badge>;
  return <Badge className="badge-muted">تاريخ إكمال أبكر</Badge>;
}

function Timeline({ cpm, schedule }: { cpm: CpmResult; schedule: Schedule }) {
  const max = Math.max(cpm.projectDuration, 1);
  const weeks = Array.from({ length: Math.ceil(max / 5) + 1 }, (_, index) => index * 5);
  return (
    <div className="timeline-wrap" dir="ltr">
      <div className="timeline-axis">
        <span>Activity</span>
        <div className="axis-days">{weeks.map((week) => <i key={week} style={{ left: `${(week / max) * 100}%` }}>D{week}</i>)}</div>
      </div>
      <div className="timeline-body">
        {cpm.activities.map((activity) => (
          <div className="timeline-row" key={activity.id}>
            <div className="timeline-label"><b>{activity.id}</b><span>{activity.name}</span></div>
            <div className="timeline-track">
              {weeks.map((week) => <i className="week-grid" key={week} style={{ left: `${(week / max) * 100}%` }} />)}
              <span
                className={`gantt-bar ${activity.kind === "fragnet" ? "gantt-bar--fragnet" : activity.isCritical ? "gantt-bar--critical" : ""}`}
                style={{ left: `${(activity.earlyStart / max) * 100}%`, width: `${Math.max((activity.duration / max) * 100, 1.4)}%` }}
                title={`${activity.id} • ${activity.duration} d • Float ${activity.totalFloat} d`}
              >
                <em>{activity.duration}d</em>
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="timeline-legend"><span><i className="legend-critical" />مسار حرج</span><span><i className="legend-fragnet" />Fragnet / حدث التأخير</span><span><i className="legend-base" />نشاط غير حرج</span></div>
      <p className="timeline-caption">الزمن المعروض أيام تقويمية نسبية من تاريخ بدء البرنامج. الأشرطة البرتقالية تمثل أنشطة الـ Fragnet المضافة إلى نسخة التحليل.</p>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<ViewKey>("overview");
  const [schedule, setSchedule] = useState<Schedule>(() => tryRestore("tia-studio-schedule", baseSchedule));
  const [events, setEvents] = useState<Fragnet[]>(() => tryRestore("tia-studio-events", [initialEvent]));
  const [selectedEventId, setSelectedEventId] = useState(() => tryRestore("tia-studio-selected-event", initialEvent.id));
  const [csvActivities, setCsvActivities] = useState<CsvActivity[] | null>(null);
  const [eventTitle, setEventTitle] = useState("تأخر اعتماد مستند فني");
  const [eventDescription, setEventDescription] = useState("يوثق هذا الـ Fragnet مدة الحدث ومنطقه بين نشاطين من البرنامج المعتمد.");
  const [eventDate, setEventDate] = useState(schedule.dataDate ?? schedule.startDate);
  const [eventDuration, setEventDuration] = useState("5");
  const [eventCause, setEventCause] = useState<Fragnet["cause"]>("employer");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState(schedule.relationships[0]?.id ?? "");
  const activityFileRef = useRef<HTMLInputElement>(null);
  const relationshipFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("tia-studio-schedule", JSON.stringify(schedule));
      window.localStorage.setItem("tia-studio-events", JSON.stringify(events));
      window.localStorage.setItem("tia-studio-selected-event", JSON.stringify(selectedEventId));
    } catch {
      // Local persistence is optional; analysis remains available for this session.
    }
  }, [schedule, events, selectedEventId]);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const analysisState = useMemo(() => {
    try {
      return { result: selectedEvent ? runTIA(schedule, selectedEvent) : null, error: "" };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "تعذر حساب التحليل." };
    }
  }, [schedule, selectedEvent]);
  const analysis = analysisState.result;
  const analysisError = analysisState.error;

  const baseline = useMemo(() => {
    try {
      return runCPM(schedule);
    } catch {
      return null;
    }
  }, [schedule]);

  const displayedCpm = analysis?.impacted ?? baseline;
  const selectedRelationship = schedule.relationships.find((relationship) => relationship.id === selectedRelationshipId);
  const criticalCount = analysis?.impacted.criticalActivityIds.length ?? baseline?.criticalActivityIds.length ?? 0;
  const delayDays = analysis?.impactDays ?? 0;
  const currentFloat = analysis?.impacted.activities.find((activity) => activity.id === selectedEvent?.activities[0]?.id)?.totalFloat;

  function loadDemo() {
    setSchedule(baseSchedule);
    setEvents([initialEvent]);
    setSelectedEventId(initialEvent.id);
    setEventDate(baseSchedule.dataDate ?? baseSchedule.startDate);
    setSelectedRelationshipId("R3");
    setCsvActivities(null);
    toast.success("تم تحميل نموذج الاختبار: أثر 6 أيام على الإكمال.");
  }

  async function importJson(file: File) {
    try {
      const raw = await file.text();
      const imported = JSON.parse(raw) as Schedule;
      if (!imported.id || !imported.name || !imported.startDate || !Array.isArray(imported.activities) || !Array.isArray(imported.relationships)) {
        throw new Error("ملف JSON لا يطابق نموذج البرنامج المطلوب.");
      }
      runCPM(imported);
      setSchedule(imported);
      setEvents([]);
      setSelectedEventId("");
      setSelectedRelationshipId(imported.relationships[0]?.id ?? "");
      setEventDate(imported.dataDate ?? imported.startDate);
      toast.success(`تم استيراد ${imported.activities.length} نشاط و${imported.relationships.length} علاقة.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر قراءة ملف JSON.");
    }
  }

  async function importActivitiesCsv(file: File) {
    try {
      const records = parseCsv(await file.text());
      const imported = records.map((record, index) => ({
        id: record.id || record.activityid || record.activity_id || `ACT-${index + 1}`,
        name: record.name || record.activityname || record.activity_name || `Activity ${index + 1}`,
        duration: Number(record.duration || record.durationdays || record.duration_days),
        wbs: record.wbs || undefined,
        owner: record.owner || undefined,
        plannedStart: record.plannedstart || record.planned_start ? Number(record.plannedstart || record.planned_start) : undefined,
      }));
      if (imported.some((activity) => !Number.isFinite(activity.duration) || activity.duration < 0)) {
        throw new Error("عمود duration مطلوب ويجب أن يحتوي أرقاماً غير سالبة.");
      }
      setCsvActivities(imported);
      toast.success(`تمت قراءة ${imported.length} نشاط. حمّل ملف العلاقات لإكمال الشبكة.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر قراءة ملف الأنشطة CSV.");
    }
  }

  async function importRelationshipsCsv(file: File) {
    try {
      if (!csvActivities) throw new Error("حمّل ملف الأنشطة أولاً، ثم ملف العلاقات.");
      const records = parseCsv(await file.text());
      const relationships: Relationship[] = records.map((record, index) => ({
        id: record.id || record.relationshipid || record.relationship_id || `REL-${index + 1}`,
        predecessorId: record.predecessorid || record.predecessor_id || record.predecessor || record.pred,
        successorId: record.successorid || record.successor_id || record.successor || record.succ,
        type: ((record.type || "FS").toUpperCase() as RelationshipType),
        lag: record.lag ? Number(record.lag) : 0,
      }));
      const imported: Schedule = {
        id: `import-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, "") || "برنامج مستورد",
        startDate: schedule.startDate,
        dataDate: schedule.dataDate,
        activities: csvActivities,
        relationships,
      };
      runCPM(imported);
      setSchedule(imported);
      setEvents([]);
      setSelectedEventId("");
      setSelectedRelationshipId(relationships[0]?.id ?? "");
      toast.success("تم استيراد الشبكة وحساب CPM بنجاح.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر قراءة ملف العلاقات CSV.");
    }
  }

  function createEvent() {
    if (!selectedRelationship) {
      toast.error("اختر علاقة منطقية في البرنامج ليتم فصلها بالـ Fragnet.");
      return;
    }
    const duration = Number(eventDuration);
    if (!eventTitle.trim() || !Number.isFinite(duration) || duration < 0) {
      toast.error("أدخل عنوان الحدث ومدة صحيحة غير سالبة.");
      return;
    }
    try {
      dateToRelativeDay(schedule.startDate, eventDate);
      const sequence = events.length + 1;
      const fragnetId = `EV-${String(sequence).padStart(3, "0")}`;
      const activityId = `FR-${String(sequence).padStart(3, "0")}`;
      const next: Fragnet = {
        id: fragnetId,
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        cause: eventCause,
        occurrenceDate: eventDate,
        activities: [{ id: activityId, name: eventTitle.trim(), duration, wbs: `TIA-${sequence}`, owner: causeLabel[eventCause], kind: "fragnet" }],
        replacedRelationshipIds: [selectedRelationship.id],
        relationships: [
          { id: `${activityId}-IN`, predecessorId: selectedRelationship.predecessorId, successorId: activityId, type: selectedRelationship.type, lag: selectedRelationship.lag ?? 0 },
          { id: `${activityId}-OUT`, predecessorId: activityId, successorId: selectedRelationship.successorId, type: "FS", lag: 0 },
        ],
      };
      runTIA(schedule, next);
      setEvents((previous) => [...previous, next]);
      setSelectedEventId(next.id);
      setView("analysis");
      toast.success("تم إدراج الـ Fragnet وحساب أثره على تاريخ الإكمال.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء حدث التأخير.");
    }
  }

  function removeEvent(id: string) {
    setEvents((previous) => previous.filter((event) => event.id !== id));
    setSelectedEventId(events.find((event) => event.id !== id)?.id ?? "");
    toast.success("تم حذف الحدث من نسخة التحليل.");
  }

  function exportSchedule() {
    downloadText("tia-studio-schedule.json", JSON.stringify(schedule, null, 2));
    toast.success("تم تجهيز نسخة البرنامج JSON للتنزيل.");
  }

  function exportAnalysis() {
    if (!analysis || !selectedEvent) return;
    downloadText(
      `${selectedEvent.id}-tia-result.json`,
      JSON.stringify({ generatedAt: new Date().toISOString(), methodology: "Time Impact Analysis — modeled/additive CPM", schedule, fragnet: selectedEvent, result: analysis }, null, 2),
    );
    toast.success("تم تجهيز ملف نتيجة TIA للتنزيل.");
  }

  const qualityItems = [
    { ok: Boolean(baseline), text: "شبكة CPM قابلة للحساب ولا تحتوي حلقة منطقية." },
    { ok: Boolean(selectedEvent && selectedEvent.relationships.length >= 2), text: "الـ Fragnet مرتبط بمنطق دخول وخروج واضح." },
    { ok: Boolean(selectedEvent?.occurrenceDate && schedule.dataDate), text: "تاريخ الحدث ونسخة التحديث موثقان." },
    { ok: Boolean(analysis?.impactDays !== undefined), text: "تمت مقارنة تاريخ الإكمال قبل وبعد الإدراج." },
  ];

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-mark" src={logoUrl} alt="TIA Studio" />
          <div><b>TIA Studio</b><span>Time Impact Analysis</span></div>
        </div>
        <div className="project-chip"><span className="project-dot" /><div><small>برنامج العمل</small><b>{schedule.name}</b></div></div>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.key} onClick={() => setView(item.key)} className={view === item.key ? "nav-item active" : "nav-item"}><Icon size={18} /><span>{item.label}</span>{item.key === "analysis" && analysis?.impactDays ? <em>+{analysis.impactDays}</em> : null}</button>;
          })}
        </nav>
        <div className="method-card">
          <BookOpenCheck size={18} />
          <strong>منهج واضح وقابل للتتبع</strong>
          <p>نسخة البرنامج ← Fragnet ← CPM ← فرق تاريخ الإكمال.</p>
          <button onClick={() => setView("report")}>عرض أسس التحليل <ChevronLeft size={15} /></button>
        </div>
        <div className="local-note"><ShieldCheck size={16} /><span>البيانات محفوظة محلياً في متصفحك.</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumbs"><span>مشروعات</span><ChevronLeft size={14} /><b>{schedule.name}</b><ChevronLeft size={14} /><strong>{navItems.find((item) => item.key === view)?.label}</strong></div>
          <div className="top-actions"><Button variant="outline" className="outline-action" onClick={exportSchedule}><Download size={16} />تصدير البرنامج</Button><Button className="run-button" onClick={() => { if (analysis) { setView("analysis"); toast.success("تم تحديث حساب TIA باستخدام البيانات الحالية."); } else toast.error("أضف حدث تأخير أولاً."); }}><Play size={16} fill="currentColor" />تشغيل التحليل</Button></div>
        </header>

        <section className="critical-ribbon" aria-label="ملخص المسار الحرج">
          <div className="ribbon-label"><Route size={17} /><span>المسار الحرج</span></div>
          <div className="path-nodes" dir="ltr">{(analysis?.impacted ?? baseline)?.criticalActivityIds.slice(0, 6).map((id, index, ids) => <span key={id}>{id}{index < ids.length - 1 && <i />}</span>)}</div>
          <div className="ribbon-date"><small>الإكمال المتوقع</small><b dir="ltr">{analysis?.impactedCompletionDate ?? baseline?.completionDate ?? "—"}</b></div>
          <StatusBadge result={analysis} />
        </section>

        {analysisError ? <div className="analysis-error"><AlertTriangle size={18} /><div><b>تعذر تحليل الشبكة</b><span>{analysisError}</span></div></div> : null}

        {view === "overview" && (
          <div className="view-stack overview-view">
            <section className="hero-panel">
              <div className="hero-copy">
                <p className="eyebrow"><ActivityIcon size={15} />نافذة التحليل 04 · بيانات {schedule.dataDate ?? schedule.startDate}</p>
                <span className="finding-label">النتيجة الحالية</span>
                <h1 dir="rtl">{analysis?.impactDays ? <><b dir="ltr">+{analysis.impactDays}</b> أيام على الإكمال المتوقع</> : "لا يوجد أثر حرج محسوب على الإكمال"}</h1>
                <p>نسخة البرنامج: <b>{schedule.name}</b> — يعرض القماش المجاور منطق الإدراج، والمسار الحرج، وتاريخ الإكمال بعد إعادة حساب CPM.</p>
                <div className="signature-path" dir="ltr"><span>A100</span><i /><span>A200</span><i /><span>A300</span><i className="fragnet-link" /><strong>{selectedEvent?.activities[0]?.id ?? "FR"}</strong><i className="fragnet-link" /><span>A400</span><em>Critical route</em></div>
                <div className="hero-actions"><Button className="run-button" onClick={() => setView("event")}><Plus size={17} />نمذجة حدث جديد</Button><Button variant="ghost" className="ghost-link" onClick={() => setView("analysis")}>عرض دليل النتيجة <ArrowUpRight size={16} /></Button></div>
              </div>
              <div className="hero-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(246,242,234,.98) 0%, rgba(246,242,234,.76) 43%, rgba(246,242,234,.08) 70%), url(${workspaceImageUrl})` }}><div className="hero-art-tag"><span>LIVE CPM CANVAS</span><b>{selectedEvent ? "FRAGNET INSERTED" : "READY FOR ANALYSIS"}</b></div><div className="canvas-date"><small>FORECAST FINISH</small><b dir="ltr">{analysis?.impactedCompletionDate ?? baseline?.completionDate ?? "—"}</b></div></div>
            </section>

            <section className="metrics-grid">
              <MetricCard label="تاريخ الأساس" value={baseline?.completionDate ?? "—"} helper="قبل إدراج الحدث" tone="graphite" />
              <MetricCard label="الأثر الزمني" value={`${delayDays > 0 ? "+" : ""}${delayDays} يوم`} helper={delayDays > 0 ? "فرق الإكمال بعد TIA" : "لا يوجد تمديد للإكمال"} tone={delayDays > 0 ? "orange" : "green"} featured />
              <MetricCard label="الإكمال بعد TIA" value={analysis?.impactedCompletionDate ?? "—"} helper="نسخة التحليل الحالية" tone="blue" featured />
              <MetricCard label="أنشطة حرجة" value={`${criticalCount}`} helper="TF = 0 ضمن النسخة الحالية" tone="graphite" />
            </section>

            <section className="overview-columns">
              <div className="panel event-panel">
                <div className="panel-heading"><div><p className="eyebrow">DELAY REGISTER</p><h2>سجل الأحداث</h2></div><Button variant="outline" className="tiny-button" onClick={() => setView("event")}><Plus size={15} />حدث جديد</Button></div>
                <div className="event-list">
                  {events.length ? events.map((event) => {
                    const preview = event.id === selectedEventId ? analysis : null;
                    return <button key={event.id} onClick={() => { setSelectedEventId(event.id); setView("analysis"); }} className={event.id === selectedEventId ? "event-row selected" : "event-row"}>
                      <span className="event-number">{event.id}</span><div><b>{event.title}</b><small>{dateLabel(event.occurrenceDate)} · {causeLabel[event.cause]}</small></div><strong className={preview?.impactDays ? "impact-number has-impact" : "impact-number"}>{preview ? `${preview.impactDays > 0 ? "+" : ""}${preview.impactDays} d` : "—"}</strong>
                    </button>;
                  }) : <div className="empty-inline"><Zap size={19} /><span>لا توجد أحداث بعد. أضف Fragnet للبدء.</span></div>}
                </div>
              </div>
              <div className="panel quality-panel">
                <div className="panel-heading"><div><p className="eyebrow">QUALITY GATE</p><h2>جاهزية التحليل</h2></div><span className="quality-score">{qualityItems.filter((item) => item.ok).length}/4</span></div>
                <div className="quality-list">{qualityItems.map((item) => <div key={item.text}><span className={item.ok ? "quality-icon ok" : "quality-icon"}>{item.ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span><p>{item.text}</p></div>)}</div>
                {(analysis?.impacted.warnings ?? baseline?.warnings ?? []).length ? <div className="warning-strip"><AlertTriangle size={16} />{(analysis?.impacted.warnings ?? baseline?.warnings ?? []).join(" ")}</div> : <div className="quality-footer"><ShieldCheck size={16} />اجتاز النموذج اختبارات البنية الأساسية.</div>}
              </div>
            </section>
          </div>
        )}

        {view === "schedule" && (
          <div className="view-stack schedule-view">
            <section className="page-heading"><div><p className="eyebrow">SCHEDULE BASE</p><h1>البرنامج المعتمد</h1><p>اختر تحديثاً سابقاً للحدث. يدعم التطبيق JSON أو ملفي CSV منفصلين للأنشطة والعلاقات.</p></div><div className="heading-actions"><Button variant="outline" className="outline-action" onClick={loadDemo}><Sparkles size={16} />تحميل نموذج الاختبار</Button><Button className="run-button" onClick={exportSchedule}><Download size={16} />تنزيل JSON</Button></div></section>
            <section className="import-deck">
              <div className="import-card primary-import"><FileText size={21} /><div><b>استيراد ملف JSON كامل</b><p>الهيكل: name، startDate، activities، relationships.</p></div><Button variant="outline" className="tiny-button" onClick={() => jsonFileRef.current?.click()}><Upload size={15} />اختيار ملف</Button><input ref={jsonFileRef} type="file" accept=".json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importJson(file); event.currentTarget.value = ""; }} /></div>
              <div className="import-card"><FileSpreadsheet size={21} /><div><b>1. CSV الأنشطة</b><p>id, name, duration, wbs, owner, plannedStart</p></div><Button variant="outline" className="tiny-button" onClick={() => activityFileRef.current?.click()}><Upload size={15} />تحميل</Button><input ref={activityFileRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importActivitiesCsv(file); event.currentTarget.value = ""; }} /></div>
              <div className="import-card"><GitBranch size={21} /><div><b>2. CSV العلاقات</b><p>id, predecessorId, successorId, type, lag</p></div><Button variant="outline" className="tiny-button" onClick={() => relationshipFileRef.current?.click()}><Upload size={15} />تحميل</Button><input ref={relationshipFileRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importRelationshipsCsv(file); event.currentTarget.value = ""; }} /></div>
            </section>
            <section className="panel schedule-panel">
              <div className="panel-heading"><div><p className="eyebrow">CPM NETWORK</p><h2>{schedule.name}</h2><span>تاريخ البدء <b dir="ltr">{schedule.startDate}</b> · تاريخ البيانات <b dir="ltr">{schedule.dataDate ?? "غير محدد"}</b></span></div><div className="table-summary"><span>{schedule.activities.length} نشاط</span><span>{schedule.relationships.length} علاقة</span><span>{baseline?.projectDuration ?? "—"} يوم</span></div></div>
              {displayedCpm ? <Timeline cpm={baseline ?? displayedCpm} schedule={schedule} /> : null}
              <div className="activity-table-wrap"><table className="activity-table"><thead><tr><th>المعرف</th><th>النشاط</th><th>WBS</th><th>المدة</th><th>ES</th><th>EF</th><th>TF</th><th>الحالة</th></tr></thead><tbody>{(baseline?.activities ?? []).map((activity) => <tr key={activity.id} className={activity.isCritical ? "critical-row" : ""}><td dir="ltr"><b>{activity.id}</b></td><td>{activity.name}</td><td dir="ltr">{activity.wbs ?? "—"}</td><td dir="ltr">{activity.duration} d</td><td dir="ltr">{activity.earlyStart}</td><td dir="ltr">{activity.earlyFinish}</td><td dir="ltr">{activity.totalFloat}</td><td>{activity.isCritical ? <Badge className="badge-delay">حرج</Badge> : <Badge className="badge-muted">عائمة متاحة</Badge>}</td></tr>)}</tbody></table></div>
            </section>
          </div>
        )}

        {view === "event" && (
          <div className="view-stack event-view">
            <section className="page-heading"><div><p className="eyebrow">MODEL THE IMPACT</p><h1>أضف حدث تأخير كـ Fragnet</h1><p>اختر علاقة قائمة ليُفصل منطقها بالـ Fragnet. بهذه الطريقة يظل مسار الحدث قابلاً للمراجعة داخل نسخة CPM.</p></div></section>
            <section className="event-workspace">
              <form className="panel event-form" onSubmit={(event) => { event.preventDefault(); createEvent(); }}>
                <div className="panel-heading"><div><p className="eyebrow">FRAGNET BUILDER</p><h2>بيانات الحدث</h2></div><span className="form-step">01 / 02</span></div>
                <div className="form-grid"><div className="form-wide"><Label htmlFor="event-title">عنوان الحدث</Label><Input id="event-title" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="مثال: تأخر اعتماد مخطط" /></div><div><Label htmlFor="event-date">تاريخ الحدوث</Label><Input id="event-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} dir="ltr" /></div><div><Label htmlFor="event-duration">مدة الحدث (أيام)</Label><Input id="event-duration" type="number" min="0" step="1" value={eventDuration} onChange={(event) => setEventDuration(event.target.value)} dir="ltr" /></div><div className="form-wide"><Label htmlFor="event-desc">وصف الدليل/الافتراض</Label><Textarea id="event-desc" value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} rows={3} /></div><div><Label>تصنيف السبب</Label><Select value={eventCause} onValueChange={(value) => setEventCause(value as Fragnet["cause"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(causeLabel).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>العلاقة التي سيحل محلها الـ Fragnet</Label><Select value={selectedRelationshipId} onValueChange={setSelectedRelationshipId}><SelectTrigger><SelectValue placeholder="اختر علاقة" /></SelectTrigger><SelectContent>{schedule.relationships.map((relationship) => <SelectItem value={relationship.id} key={relationship.id}><span dir="ltr">{relationship.predecessorId} → {relationship.successorId}</span> · {relationship.type}</SelectItem>)}</SelectContent></Select></div></div>
                <div className="logic-preview"><GitBranch size={18} /><div><small>المسار المنطقي بعد الإدراج</small>{selectedRelationship ? <b dir="ltr">{selectedRelationship.predecessorId} → FR-{String(events.length + 1).padStart(3, "0")} → {selectedRelationship.successorId}</b> : <b>اختر علاقة منطقية</b>}</div><span>{selectedRelationship ? `${activityName(schedule, selectedRelationship.predecessorId)} ← أثر الحدث ← ${activityName(schedule, selectedRelationship.successorId)}` : ""}</span></div>
                <div className="form-actions"><p><Info size={16} />الأداة تقارن نسخة قبل الإدراج بنسخة بعده، ولا تحكم وحدها على التعويض أو الاستحقاق التعاقدي.</p><Button type="submit" className="run-button"><Play size={16} fill="currentColor" />إنشاء الـ Fragnet وتشغيل TIA</Button></div>
              </form>
              <aside className="event-guide">
                <div><span className="guide-number">1</span><h3>النسخة المختارة</h3><p>استخدم آخر تحديث مقبول قبل تاريخ الحدث، مع حالة التقدم المعروفة.</p></div><div><span className="guide-number">2</span><h3>المنطق لا الاسم</h3><p>شبكة صغيرة وروابط واقعية أفضل من نشاط واحد معزول.</p></div><div><span className="guide-number">3</span><h3>الأثر لا العائمة فقط</h3><p>تمديد الوقت يظهر فقط إذا تغير تاريخ الإكمال أو milestone محل القياس.</p></div><div className="guide-foot"><CalendarDays size={18} /><span>تاريخ بيانات النسخة الحالية: <b dir="ltr">{schedule.dataDate ?? "غير محدد"}</b></span></div>
              </aside>
            </section>
          </div>
        )}

        {view === "analysis" && (
          <div className="view-stack analysis-view">
            <section className="page-heading"><div><p className="eyebrow">BEFORE / AFTER COMPARISON</p><h1>نتيجة Time Impact Analysis</h1><p>{selectedEvent ? `حدث: ${selectedEvent.title} — ${causeLabel[selectedEvent.cause]}` : "اختر حدث تأخير أو أنشئ حدثاً جديداً."}</p></div><div className="heading-actions">{selectedEvent ? <Button variant="outline" className="outline-action" onClick={() => removeEvent(selectedEvent.id)}><X size={16} />حذف من التحليل</Button> : null}<Button className="run-button" onClick={exportAnalysis} disabled={!analysis}><Download size={16} />تنزيل النتيجة</Button></div></section>
            {analysis && displayedCpm ? <>
              <section className="impact-banner" style={{ backgroundImage: `linear-gradient(100deg, rgba(11,79,108,.97), rgba(11,79,108,.88) 47%, rgba(11,79,108,.46)), url(${reportTextureUrl})` }}>
                <div><p>الأثر المحسوب على الإكمال</p><strong dir="ltr">{analysis.impactDays > 0 ? "+" : ""}{analysis.impactDays}<small> يوم تقويمي</small></strong><span>{analysis.outcome === "delayed" ? "أضاف الـ Fragnet مساراً حرجاً إلى الإكمال المتوقع." : analysis.outcome === "float-consumed" ? "لم يتغير الإكمال المتوقع؛ الأثر استهلك عائمة متاحة أو بقي غير حرج." : "تحقق من العلاقات أو الـ leads لأن الإكمال أصبح أبكر."}</span></div><div className="impact-dates"><div><small>قبل الإدراج</small><b dir="ltr">{analysis.baselineCompletionDate}</b></div><i><ArrowUpRight size={20} /></i><div className="after-date"><small>بعد الإدراج</small><b dir="ltr">{analysis.impactedCompletionDate}</b></div></div>
              </section>
              <section className="metrics-grid analysis-metrics"><MetricCard label="حدث التحليل" value={selectedEvent?.id ?? "—"} helper={selectedEvent?.occurrenceDate ? `وقع في ${dateLabel(selectedEvent.occurrenceDate)}` : ""} tone="graphite" /><MetricCard label="مدة الـ Fragnet" value={`${selectedEvent?.activities[0]?.duration ?? 0} يوم`} helper="نشاط مضاف إلى الشبكة" tone="orange" /><MetricCard label="عائمة الـ Fragnet" value={`${currentFloat ?? "—"} يوم`} helper="TF بعد إعادة حساب CPM" tone="blue" /><MetricCard label="المسار الحرج" value={`${analysis.impacted.criticalActivityIds.length} نشاط`} helper="بعد إدراج الحدث" tone="graphite" /></section>
              <section className="analysis-grid"><div className="panel timeline-panel"><div className="panel-heading"><div><p className="eyebrow">IMPACTED CPM</p><h2>الشبكة بعد إدراج الـ Fragnet</h2></div><StatusBadge result={analysis} /></div><Timeline cpm={displayedCpm} schedule={schedule} /></div><div className="panel evidence-panel"><div className="panel-heading"><div><p className="eyebrow">EVIDENCE TRACE</p><h2>سجل الحساب</h2></div></div><ol>{analysis.notes.map((note) => <li key={note}><span><CheckCircle2 size={16} /></span>{note}</li>)}</ol><div className="mini-divider" /><div className="evidence-meta"><div><small>نوع التحليل</small><b>Modeled / Additive</b></div><div><small>قاعدة المقارنة</small><b>{schedule.name}</b></div><div><small>التقويم</small><b>أيام تقويمية</b></div></div></div></section>
              <section className="panel result-table-panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVITY IMPACT TABLE</p><h2>تفصيل العائمة والمسار</h2></div><span className="legend-note"><i className="legend-fragnet" />نشاط Fragnet</span></div><div className="activity-table-wrap"><table className="activity-table"><thead><tr><th>المعرف</th><th>النشاط</th><th>النوع</th><th>المدة</th><th>ES / EF</th><th>LS / LF</th><th>TF</th><th>المسار</th></tr></thead><tbody>{displayedCpm.activities.map((activity) => <tr key={activity.id} className={activity.kind === "fragnet" ? "fragnet-row" : activity.isCritical ? "critical-row" : ""}><td dir="ltr"><b>{activity.id}</b></td><td>{activity.name}</td><td>{activity.kind === "fragnet" ? <Badge className="badge-fragnet">Fragnet</Badge> : <Badge className="badge-muted">أساس</Badge>}</td><td dir="ltr">{activity.duration} d</td><td dir="ltr">{activity.earlyStart} / {activity.earlyFinish}</td><td dir="ltr">{activity.lateStart} / {activity.lateFinish}</td><td dir="ltr">{activity.totalFloat}</td><td>{activity.isCritical ? <Badge className="badge-delay">حرج</Badge> : <Badge className="badge-muted">غير حرج</Badge>}</td></tr>)}</tbody></table></div></section>
            </> : <section className="empty-state"><Zap size={28} /><h2>لا توجد نتيجة محسوبة بعد</h2><p>أضف حدث تأخير واربطه بعلاقة منطقية من البرنامج، ثم شغّل التحليل.</p><Button className="run-button" onClick={() => setView("event")}>إنشاء حدث تأخير</Button></section>}
          </div>
        )}

        {view === "report" && (
          <div className="view-stack report-view">
            <section className="page-heading no-print"><div><p className="eyebrow">EXPORTABLE RECORD</p><h1>تقرير TIA</h1><p>ملخص فني قابل للطباعة والمراجعة. يبقى الحكم التعاقدي والقانوني بيد المختص.</p></div><div className="heading-actions"><Button variant="outline" className="outline-action" onClick={exportAnalysis} disabled={!analysis}><Download size={16} />تنزيل JSON</Button><Button className="run-button" onClick={() => window.print()}><Printer size={16} />طباعة التقرير</Button></div></section>
            <article className="print-report">
              <div className="report-topline"><div className="report-brand"><img src={logoUrl} alt="" /><div><b>TIA Studio</b><span>Time Impact Analysis Record</span></div></div><div><small>تاريخ الإصدار</small><b dir="ltr">{new Date().toISOString().slice(0, 10)}</b></div></div>
              <div className="report-title"><div><p>تحليل أثر زمني</p><h2>{selectedEvent?.title ?? "لم يتم اختيار حدث"}</h2><span>{selectedEvent?.description ?? "أنشئ حدث تأخير لإصدار تقرير تحليل."}</span></div><StatusBadge result={analysis} /></div>
              <div className="report-facts"><div><small>المشروع / النسخة</small><b>{schedule.name}</b></div><div><small>تاريخ بيانات البرنامج</small><b dir="ltr">{schedule.dataDate ?? "غير محدد"}</b></div><div><small>تاريخ الحدث</small><b dir="ltr">{selectedEvent?.occurrenceDate ?? "—"}</b></div><div><small>تصنيف السبب</small><b>{selectedEvent ? causeLabel[selectedEvent.cause] : "—"}</b></div></div>
              <section className="report-result"><div><small>تاريخ الإكمال قبل TIA</small><b dir="ltr">{analysis?.baselineCompletionDate ?? baseline?.completionDate ?? "—"}</b></div><div className="report-impact"><small>فرق الإكمال المحسوب</small><strong dir="ltr">{analysis ? `${analysis.impactDays > 0 ? "+" : ""}${analysis.impactDays} يوم` : "—"}</strong></div><div><small>تاريخ الإكمال بعد TIA</small><b dir="ltr">{analysis?.impactedCompletionDate ?? "—"}</b></div></section>
              <section className="report-section"><h3>أساس الطريقة</h3><p>تم الحساب بطريقة <b>Time Impact Analysis</b> القائمة على نمذجة حدث التأخير بإضافة Fragnet إلى نسخة من البرنامج الزمني المختار، ثم إعادة حساب شبكة CPM ومقارنة تاريخ الإكمال قبل الإدراج وبعده. يستخدم هذا التقرير الأيام التقويمية، ويعتمد على صحة برنامج الأساس ومنطق العلاقات وحالة التقدم عند تاريخ الحدث.</p></section>
              <section className="report-section"><h3>منطق الحدث</h3>{selectedEvent ? <div className="report-logic"><b dir="ltr">{selectedEvent.relationships[0]?.predecessorId}</b><span>←</span><strong dir="ltr">{selectedEvent.activities[0]?.id} · {selectedEvent.activities[0]?.duration}d</strong><span>←</span><b dir="ltr">{selectedEvent.relationships[1]?.successorId}</b></div> : <p>لا توجد شبكة حدث مسجلة.</p>}</section>
              <section className="report-section"><h3>نتيجة فنية وتنبيهات</h3><ul>{analysis?.notes.map((note) => <li key={note}>{note}</li>) ?? <li>أضف حدث تأخير لتوليد النتيجة.</li>}</ul></section>
              <section className="report-disclaimer"><Info size={17} /><p><b>تنبيه مهني:</b> يقيس هذا التقرير الأثر الزمني الناتج عن البيانات المدخلة، ولا يقرر بمفرده الاستحقاق الزمني أو التعويض أو التزامن أو تفسير العقد. راجع المستندات المعاصرة وبنود العقد بواسطة مختص قبل استخدامه في مطالبة أو نزاع.</p></section>
            </article>
          </div>
        )}
      </main>
    </div>
  );
}
