import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, FileUp, FolderCheck, GitBranch, LoaderCircle, Network, ShieldCheck, SplitSquareVertical, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildActivitySplitFragnet, type DelayCause, type Fragnet, type Schedule } from "@/lib/cpm";
import { downloadIssueImportTemplate, parseIssueRegisterExcel, type ExcelIssueRow } from "@/lib/issue-excel";
import type { XerImportSummary } from "@/lib/xer";
import "./guided-analysis.css";

export type ScheduleStage = "baseline" | "pre-event-update" | "later-update";
export type ScheduleSnapshot = { id: string; stage: ScheduleStage; fileName: string; schedule: Schedule; summary?: XerImportSummary };
type Props = {
  schedule: Schedule; xerSummary: XerImportSummary | null; journeyPath: "issue" | "direct" | null; journeyStep: number; p6GateApproved: boolean; isXerImporting?: boolean;
  baselineSnapshot: ScheduleSnapshot | null; updateSnapshots: ScheduleSnapshot[];
  onJourneyPathChange: (value: "issue" | "direct" | null) => void; onJourneyStepChange: (step: number) => void; onP6GateApprovedChange: (value: boolean) => void;
  onScheduleUpload: (stage: ScheduleStage, file: File) => Promise<void>; onNavigate: (view: "schedule" | "issues" | "event" | "analysis" | "learning") => void;
  onApplyIssueExcel: (rows: ExcelIssueRow[]) => void; initialMethod?: "TIA" | "Windows" | "Disruption" | "Quantity";
  onPrepareSplit: (input: { activityId: string; title: string; description: string; occurrenceDate: string; duration: number; cause: DelayCause }) => void;
};

const steps = ["الموسوعة", "المنهج", "Baseline", "Updates", "Excel", "التقسيم", "الحساب"];
const dataDate = (schedule?: Schedule | null) => schedule?.dataDate || "غير مسجل";

function FileSlot({ title, description, snapshot, loading, onPick }: { title: string; description: string; snapshot?: ScheduleSnapshot | null; loading: boolean; onPick: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <div className={`guided-file-slot ${snapshot ? "guided-file-slot--ready" : ""}`}><input ref={inputRef} className="sr-only" type="file" accept=".xer,.xml,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); event.currentTarget.value = ""; }} />
    <span className="guided-file-slot__icon"><FileUp size={21} /></span><div><strong>{title}</strong><p>{snapshot ? `${snapshot.fileName} · ${snapshot.schedule.activities.length} نشاط · ${snapshot.schedule.relationships.length} علاقة` : description}</p>{snapshot && <small>Data Date: {dataDate(snapshot.schedule)} · المصدر: {snapshot.schedule.source ?? "محلي"}</small>}</div>
    <Button type="button" size="sm" variant={snapshot ? "outline" : "default"} disabled={loading} onClick={() => inputRef.current?.click()}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}{snapshot ? "استبدال" : "رفع"}</Button>
  </div>;
}

export function GuidedAnalysisPanel({ schedule, xerSummary, journeyPath, journeyStep, p6GateApproved, isXerImporting = false, baselineSnapshot, updateSnapshots, onJourneyPathChange, onJourneyStepChange, onP6GateApprovedChange, onScheduleUpload, onNavigate, onApplyIssueExcel, onPrepareSplit, initialMethod = "TIA" }: Props) {
  const [method, setMethod] = useState(initialMethod);
  const [rows, setRows] = useState<ExcelIssueRow[]>([]);
  const [excelErrors, setExcelErrors] = useState<string[]>([]);
  const [readingExcel, setReadingExcel] = useState(false);
  const [activityId, setActivityId] = useState("");
  const [title, setTitle] = useState("حدث تأخير محل التحليل");
  const [description, setDescription] = useState("تقسيم النشاط المتأثر وفق نموذج Workshop 8 قبل إدراج حدث TIA.");
  const [occurrenceDate, setOccurrenceDate] = useState(schedule.dataDate ?? schedule.startDate);
  const [duration, setDuration] = useState("1");
  const [cause, setCause] = useState<DelayCause>("employer");
  const excelRef = useRef<HTMLInputElement>(null);
  const preEventUpdate = updateSnapshots.find(item => item.stage === "pre-event-update") ?? null;
  const laterUpdates = updateSnapshots.filter(item => item.stage === "later-update");
  const target = schedule.activities.find(item => item.id === activityId);
  const p6Source = baselineSnapshot?.schedule.source === "xer" || baselineSnapshot?.schedule.source === "p6-xml";

  useEffect(() => {
    setActivityId(current => schedule.activities.some(item => item.id === current) ? current : schedule.activities[0]?.id ?? "");
    setOccurrenceDate(schedule.dataDate ?? schedule.startDate);
    onP6GateApprovedChange(false);
  }, [schedule.id]);

  const splitPreview = useMemo(() => {
    if (!target || !title.trim() || !occurrenceDate || !Number.isFinite(Number(duration)) || Number(duration) < 0) return { fragnet: null as Fragnet | null, error: "اختر نشاطاً وأدخل عنواناً وتاريخاً ومدة صحيحة." };
    try {
      return { fragnet: buildActivitySplitFragnet(schedule, { id: "SPLIT-PREVIEW", title: title.trim(), description: description.trim(), cause, occurrenceDate, eventDuration: Number(duration), targetActivityId: target.id }), error: "" };
    } catch (error) { return { fragnet: null as Fragnet | null, error: error instanceof Error ? error.message : "تعذر إعداد معاينة التقسيم." }; }
  }, [schedule, target?.id, title, description, cause, occurrenceDate, duration]);

  function next() {
    if (journeyStep === 1 && !journeyPath) return toast.error("اختر مسار سجل القضايا أو التحليل المباشر.");
    if (journeyStep === 3 && !baselineSnapshot) return toast.error("رفع Baseline إلزامي قبل بدء تحليل TIA.");
    if (journeyStep === 4 && !preEventUpdate) return toast.error("ارفع آخر Update قبل الحدث؛ فهو نسخة Pre-TIA اللازمة للقياس.");
    if (journeyStep === 4 && p6Source && !p6GateApproved) return toast.error("أقرّ مراجعة تقويم P6 وData Date قبل متابعة التحليل.");
    if (journeyStep === 5 && !rows.length) return toast.error("أدخل واقعة واحدة أو ارفع Excel صحيحاً قبل النمذجة.");
    if (journeyStep === 6 && !splitPreview.fragnet) return toast.error(splitPreview.error);
    onJourneyStepChange(Math.min(7, journeyStep + 1));
  }

  async function readExcel(file: File) {
    setReadingExcel(true);
    try {
      const parsed = parseIssueRegisterExcel(await file.arrayBuffer(), schedule);
      setRows(parsed.rows); setExcelErrors(parsed.errors);
      if (parsed.errors.length) toast.error(`تمت قراءة Excel مع ${parsed.errors.length} ملاحظة تحتاج تصحيحاً.`);
      else { onApplyIssueExcel(parsed.rows); toast.success(`تمت مراجعة ${parsed.rows.length} واقعة مقابل البرنامج المستورد.`); }
    } catch (error) { setRows([]); setExcelErrors([error instanceof Error ? error.message : "تعذر قراءة ملف Excel."]); } finally { setReadingExcel(false); }
  }

  function addDirectRow() {
    if (!target || !title.trim() || !occurrenceDate || !Number.isFinite(Number(duration)) || Number(duration) <= 0) return toast.error("أكمل النشاط والعنوان والتاريخ والمدة أولاً.");
    const relation = schedule.relationships.find(item => item.predecessorId === target.id || item.successorId === target.id);
    if (!relation) return toast.error("النشاط المختار لا يملك علاقة منطقية. اختر نشاطاً مرتبطاً أو استخدم Excel لتحديد رابط Fragnet.");
    const excelCause = cause === "concurrent" ? "neutral" : cause;
    const row: ExcelIssueRow = { rowNumber: 0, issueNo: `TIA-${String(rows.length + 1).padStart(3, "0")}`, title: title.trim(), occurrenceDate, reportedBy: "محلل TIA", responsibleParty: cause === "employer" ? "employer" : cause === "contractor" ? "contractor" : "undetermined", delayCause: excelCause, criticality: "potentially_critical", proposedDurationDays: Number(duration), replacedRelationshipId: relation.id, affectedActivityIds: [target.id], description: description.trim() || "واقعة منظمة في Workshop 8.", impactSummary: "يُراجع الأثر زمنياً بعد إدراج الحدث في نسخة Post-TIA.", referenceNotes: "يلزم توثيق المراسلات والأدلة قبل إصدار المطالبة." };
    const nextRows = [...rows, row]; setRows(nextRows); setExcelErrors([]); onApplyIssueExcel(nextRows); toast.success("أضيفت الواقعة المنظمة إلى سجل Workshop 8.");
  }

  return <section className="guided-panel" dir="rtl">
    <header className="guided-panel__header"><div><Badge className="guided-panel__badge">Workshop 8 · رحلة TIA</Badge><h2>حلّل الواقعة بالتسلسل الصحيح</h2><p>تعلم، اختر المنهج، وثّق نسخ البرنامج والواقعة، ثم راجع التقسيم قبل الحساب.</p></div><div className="guided-panel__status"><b>{journeyStep} / 7</b><small>الخطوة الحالية</small></div></header>
    <ol className="guided-stepper">{steps.map((label, index) => <li key={label} className={journeyStep === index + 1 ? "is-active" : journeyStep > index + 1 ? "is-done" : ""}><span>{journeyStep > index + 1 ? <CheckCircle2 size={16} /> : index + 1}</span><em>{label}</em></li>)}</ol>

    {journeyStep === 1 && <div className="guided-content"><div className="guided-hero-card"><BookOpenCheck size={28} /><div><h3>ابدأ من الموسوعة، لا من التخمين</h3><p>ابحث عن الحالة أو الدرس، ثم عد إلى هذه الرحلة لتوثيقها. اختر المسار المناسب قبل تحميل ملفات المشروع.</p><Button type="button" variant="outline" onClick={() => onNavigate("learning")}>افتح الموسوعة والدروس <ChevronLeft size={16} /></Button></div></div><div className="guided-paths"><button type="button" className={journeyPath === "issue" ? "is-selected" : ""} onClick={() => onJourneyPathChange("issue")}><FileSpreadsheet size={24} /><strong>سجل القضايا أولاً</strong><span>لواقعات متعددة تحتاج أدلة ومراجعة قبل النمذجة.</span></button><button type="button" className={journeyPath === "direct" ? "is-selected" : ""} onClick={() => onJourneyPathChange("direct")}><Network size={24} /><strong>تحليل مباشر</strong><span>لواقعة واحدة جاهزة مع تاريخها وبياناتها.</span></button></div></div>}

    {journeyStep === 2 && <div className="guided-content"><div className="guided-section-heading"><GitBranch size={22} /><div><h3>اختر منهج التحليل ولماذا</h3><p>لا يغير هذا الاختيار الملف الأصلي؛ إنما يحدد الإطار التحليلي والمسار التعليمي.</p></div></div><div className="guided-method-grid">{[["TIA", "Time Impact Analysis", "حدث يحتاج قياس الأثر على برنامج متقبل."], ["Windows", "Window Analysis", "واقعات متتابعة ضمن نوافذ زمنية."], ["Disruption", "Disruption Analysis", "تعطيل أو فقد إنتاجية لا يختزل في حدث واحد."], ["Quantity", "زيادة كميات", "تغير نطاق أو كمية يحتاج قياس أثره." ]].map(([id, english, note]) => <button type="button" key={id} className={method === id ? "is-selected" : ""} onClick={() => setMethod(id as "TIA" | "Windows" | "Disruption" | "Quantity")}><strong>{id}</strong><small>{english}</small><span>{note}</span></button>)}</div><p className="guided-disclosure">المحرك المحلي ينفذ <b>TIA</b> ببرنامج CPM. المسارات الأخرى تبقى موثقة في الموسوعة والسجلات ولا تُعرض كحساب TIA تلقائي.</p></div>}

    {journeyStep === 3 && <div className="guided-content"><div className="guided-section-heading"><FolderCheck size={22} /><div><h3>ارفع Baseline المعتمد</h3><p>الملف للقراءة فقط. عند الحساب ستنشأ نسخ Pre-TIA وPost-TIA مستقلة ولن يتغير ملفك الأصلي.</p></div></div><FileSlot title="Baseline المعتمد" description="XER أو XML أو JSON من Primavera P6" snapshot={baselineSnapshot} loading={isXerImporting} onPick={file => onScheduleUpload("baseline", file)} />{baselineSnapshot && <div className="guided-stat-grid"><div><b>{baselineSnapshot.schedule.activities.length}</b><small>الأنشطة</small></div><div><b>{baselineSnapshot.schedule.relationships.length}</b><small>العلاقات</small></div><div><b>{baselineSnapshot.schedule.wbsNodes?.length ?? baselineSnapshot.summary?.wbsRead ?? 0}</b><small>WBS</small></div><div><b>{baselineSnapshot.schedule.resourceAssignments?.length ?? baselineSnapshot.summary?.resourceAssignmentsRead ?? 0}</b><small>إسنادات موارد</small></div></div>}</div>}

    {journeyStep === 4 && <div className="guided-content"><div className="guided-section-heading"><GitBranch size={22} /><div><h3>Update قبل الحدث والتحديثات اللاحقة</h3><p>آخر Update قبل الواقعة هو لقطة Pre-TIA. أما التحديثات اللاحقة فتبقى للمقارنة والتتبع ولا تستبدل Baseline تلقائياً.</p></div></div><FileSlot title="آخر Update قبل الحدث (إلزامي)" description="اختر النسخة الأقرب قبل تاريخ الواقعة" snapshot={preEventUpdate} loading={isXerImporting} onPick={file => onScheduleUpload("pre-event-update", file)} />{preEventUpdate && <div className="guided-compare-strip"><span>Baseline: {baselineSnapshot?.schedule.activities.length ?? 0} نشاط</span><ChevronLeft size={15} /><span>Pre-TIA: {preEventUpdate.schedule.activities.length} نشاط</span><Badge variant="outline">Data Date: {dataDate(preEventUpdate.schedule)}</Badge></div>}<FileSlot title="تحديث لاحق (اختياري)" description="يمكن حفظ أكثر من تحديث للمتابعة بعد الحدث" snapshot={laterUpdates.at(-1)} loading={isXerImporting} onPick={file => onScheduleUpload("later-update", file)} />{laterUpdates.length > 0 && <p className="guided-file-history">تم حفظ {laterUpdates.length} تحديث لاحق للقراءة والمقارنة.</p>}{p6Source && <div className="guided-gate"><div><ShieldCheck size={21} /><strong>بوابة تحقق P6</strong><p>راجع التقويم وData Date وعدادات الأنشطة والعلاقات قبل اعتماد نسخة Pre-TIA.</p></div><label><input type="checkbox" checked={p6GateApproved} onChange={event => onP6GateApprovedChange(event.target.checked)} /> أقرّ بمراجعة بيانات P6 قبل التحليل.</label>{xerSummary?.warnings?.slice(0, 3).map(warning => <p key={warning}><AlertTriangle size={14} />{warning}</p>)}</div>}</div>}

    {journeyStep === 5 && <div className="guided-content"><div className="guided-section-heading"><FileSpreadsheet size={22} /><div><h3>سجل الواقعة المنظم — Workshop 8</h3><p>نزّل القالب أو أدخل واقعة مباشرة. تتحقق المنصة محلياً من نشاطك وعلاقته المنطقية في البرنامج المستورد.</p></div></div><div className="guided-excel-actions"><Button type="button" variant="outline" onClick={downloadIssueImportTemplate}><FileSpreadsheet size={16} />تنزيل قالب Excel</Button><input ref={excelRef} className="sr-only" type="file" accept=".xlsx,.xls" onChange={event => { const file = event.target.files?.[0]; if (file) readExcel(file); event.currentTarget.value = ""; }} /><Button type="button" onClick={() => excelRef.current?.click()} disabled={readingExcel}>{readingExcel ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}رفع Excel</Button></div><div className="guided-direct-form"><div><Label>النشاط المتأثر</Label><Select value={activityId} onValueChange={setActivityId}><SelectTrigger><SelectValue placeholder="اختر من البرنامج" /></SelectTrigger><SelectContent>{schedule.activities.map(activity => <SelectItem value={activity.id} key={activity.id}>{activity.id} — {activity.name}</SelectItem>)}</SelectContent></Select></div><div><Label>تاريخ الواقعة</Label><Input type="date" value={occurrenceDate} onChange={event => setOccurrenceDate(event.target.value)} /></div><div><Label>المدة (يوم عمل)</Label><Input type="number" min="0" value={duration} onChange={event => setDuration(event.target.value)} /></div><div><Label>السبب / المسؤولية</Label><Select value={cause} onValueChange={value => setCause(value as DelayCause)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employer">صاحب العمل Employer</SelectItem><SelectItem value="contractor">المقاول Contractor</SelectItem><SelectItem value="neutral">محايد / عام</SelectItem></SelectContent></Select></div><div className="guided-direct-form__wide"><Label>عنوان ووصف الحدث</Label><Input value={title} onChange={event => setTitle(event.target.value)} /><Textarea value={description} onChange={event => setDescription(event.target.value)} /></div><Button type="button" variant="outline" onClick={addDirectRow}>أضف الواقعة للنموذج</Button></div>{excelErrors.length > 0 && <div className="guided-errors">{excelErrors.map(error => <p key={error}><AlertTriangle size={15} />{error}</p>)}</div>}{rows.length > 0 && <div className="guided-row-summary"><CheckCircle2 size={18} />جاهز للمراجعة: {rows.length} واقعة منظمة مطابقة للبرنامج الحالي.</div>}</div>}

    {journeyStep === 6 && <div className="guided-content"><div className="guided-section-heading"><SplitSquareVertical size={22} /><div><h3>راجع تقسيم النشاط: Pre / Event / Post</h3><p>المعاينة مبنية على محرك CPM وعلى نسخة Pre-TIA؛ تغيير تاريخ الواقعة يعيد حساب مدتي قبل/بعد الحدث.</p></div></div><div className="guided-split-controls"><div><Label>النشاط المتأثر</Label><Select value={activityId} onValueChange={setActivityId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{schedule.activities.map(activity => <SelectItem key={activity.id} value={activity.id}>{activity.id} — {activity.name}</SelectItem>)}</SelectContent></Select></div><div><Label>تاريخ الحدث</Label><Input type="date" value={occurrenceDate} onChange={event => setOccurrenceDate(event.target.value)} /></div><div><Label>مدة الحدث</Label><Input type="number" min="0" value={duration} onChange={event => setDuration(event.target.value)} /></div></div>{splitPreview.fragnet ? <><div className="guided-split-visual">{splitPreview.fragnet.activities.map((activity, index) => <div key={activity.id} className={`guided-split-segment guided-split-segment--${index}`}><small>{index === 0 ? "Pre" : index === 1 ? "Event" : "Post"}</small><b>{activity.duration} يوم</b><span>{activity.name}</span></div>)}</div><p className="guided-split-note"><CheckCircle2 size={17} />يستبدل النشاط داخل <b>Post-TIA فقط</b> بثلاثة أنشطة مرتبطة FS بلا Lag. ملف Baseline محفوظ للقراءة.</p></> : <div className="guided-errors"><p><AlertTriangle size={15} />{splitPreview.error}</p></div>}</div>}

    {journeyStep === 7 && <div className="guided-content"><div className="guided-hero-card guided-hero-card--ready"><ShieldCheck size={28} /><div><h3>النسخة التحليلية جاهزة للحساب</h3><p>تمت مراجعة الملفات والواقعة والتقسيم. سينشئ المحرك نسختين مستقلتين Pre-TIA وPost-TIA، ثم يحسب أثر الزمن محلياً.</p><Button type="button" onClick={() => { if (!splitPreview.fragnet) return toast.error(splitPreview.error); onPrepareSplit({ activityId, title, description, occurrenceDate, duration: Number(duration), cause }); onNavigate("event"); }}>افتح الحساب وإنشاء الحدث <ChevronLeft size={16} /></Button></div></div></div>}

    <footer className="guided-footer"><Button type="button" variant="outline" disabled={journeyStep === 1} onClick={() => onJourneyStepChange(Math.max(1, journeyStep - 1))}><ChevronRight size={16} />السابق</Button>{journeyStep < 7 ? <Button type="button" onClick={next}>التالي <ChevronLeft size={16} /></Button> : <Button type="button" variant="outline" onClick={() => onNavigate("analysis")}>عرض النتائج</Button>}</footer>
  </section>;
}
