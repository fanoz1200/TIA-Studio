import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Download, FileCog, FileUp, LogIn, Plus, ShieldCheck, Table2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import type { Fragnet, Relationship, Schedule } from "@/lib/cpm";
import { issueProposalToFragnet, type IssueFragnetProposal } from "@/lib/issue-fragnet";
import { downloadIssueImportTemplate, exportIssueRegisterExcel, parseIssueRegisterExcel, type ExcelIssueRow } from "@/lib/issue-excel";
import "./issue-log.css";

type View = "guided" | "overview" | "schedule" | "event" | "windows" | "methods" | "analysis" | "report" | "financial" | "notices" | "review" | "members" | "compare" | "resources" | "learning" | "issues";

const responsibilityLabel: Record<string, string> = { employer: "صاحب العمل", contractor: "المقاول", engineer: "المهندس", third_party: "طرف ثالث", undetermined: "غير محددة" };
const causeLabel: Record<string, string> = { employer: "صاحب العمل", contractor: "المقاول", neutral: "محايد / قيد التحقق" };
const criticalityLabel: Record<string, string> = { unknown: "قيد التقييم", potentially_critical: "مرشح للحرجية", critical: "حرج", noncritical: "غير حرج" };
const statusLabel: Record<string, string> = { open: "مفتوحة", ready_for_fragnet: "جاهزة للمراجعة", applied: "طُبقت في TIA", rejected: "مرفوضة", closed: "مغلقة" };

function parseProposal(raw: string): IssueFragnetProposal | null {
  try {
    const proposal = JSON.parse(raw) as IssueFragnetProposal;
    return proposal?.id && proposal.relationshipId && proposal.title ? proposal : null;
  } catch { return null; }
}

function parseAffectedActivities(raw: string) {
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value.map(String) : []; } catch { return []; }
}

function dateInput(value: Date | string) { return new Date(value).toISOString().slice(0, 10); }

export function IssueLogPanel({ view, schedule, existingEvents, isAuthenticated, onApplyFragnet }: { view: View; schedule: Schedule; existingEvents: Fragnet[]; isAuthenticated: boolean; onApplyFragnet: (event: Fragnet) => void }) {
  const utils = trpc.useUtils();
  const projectInput = useMemo(() => ({ projectKey: schedule.id }), [schedule.id]);
  const issues = trpc.issueLog.list.useQuery(projectInput, { enabled: isAuthenticated && view === "issues" });
  const create = trpc.issueLog.create.useMutation({ onSuccess: () => { utils.issueLog.list.invalidate(projectInput); setTitle(""); setDescription(""); setImpactSummary(""); setReferenceNotes(""); setIssueNo(""); setRelationshipIds([]); toast.success("تم حفظ القضية ومقترح الـ Fragnet للمراجعة."); }, onError: error => toast.error(error.message) });
  const prepare = trpc.issueLog.prepareFragnet.useMutation({ onSuccess: raw => { const proposal = parseProposal(raw); setPreview(proposal); utils.issueLog.list.invalidate(projectInput); toast.success("تم تجهيز المقترح للمراجعة الفنية قبل إدراجه."); }, onError: error => toast.error(error.message) });
  const recordApplied = trpc.issueLog.recordApplied.useMutation({ onSuccess: raw => { const proposal = parseProposal(raw); const relationship = proposal ? schedule.relationships.find(item => item.id === proposal.relationshipId) : undefined; if (!proposal || !relationship) { toast.error("لم تعد العلاقة المرجعية موجودة في النسخة الحالية من البرنامج؛ لم يطبق المقترح."); return; }
    if (existingEvents.some(event => event.id === proposal.id)) { toast.error("هذا الـ Fragnet موجود بالفعل في نسخة TIA المحلية."); return; }
    onApplyFragnet(issueProposalToFragnet(proposal, relationship)); setPreview(null); utils.issueLog.list.invalidate(projectInput); toast.success("تم تسجيل إدراج القضية في نسخة TIA المستقلة. راجع حساب الأثر قبل اعتماد المطالبة."); }, onError: error => toast.error(error.message) });
  const close = trpc.issueLog.close.useMutation({ onSuccess: () => { utils.issueLog.list.invalidate(projectInput); toast.success("تم تحديث حالة القضية مع حفظ أثر المراجعة."); }, onError: error => toast.error(error.message) });
  const importBatch = trpc.issueLog.importBatch.useMutation({ onSuccess: count => { utils.issueLog.list.invalidate(projectInput); setImportRows([]); setImportErrors([]); setTitle(""); setDescription(""); setImpactSummary(""); setReferenceNotes(""); setIssueNo(""); setRelationshipIds([]); toast.success(`تم حفظ ${count} قضية/نقطة ربط بعد التحقق. لم يُطبق أي Fragnet تلقائياً.`); }, onError: error => toast.error(error.message) });

  const [issueNo, setIssueNo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impactSummary, setImpactSummary] = useState("");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [occurrenceDate, setOccurrenceDate] = useState(schedule.dataDate ?? schedule.startDate);
  const [reportedBy, setReportedBy] = useState("");
  const [responsibility, setResponsibility] = useState<"employer" | "contractor" | "engineer" | "third_party" | "undetermined">("undetermined");
  const [cause, setCause] = useState<"employer" | "contractor" | "neutral">("neutral");
  const [criticality, setCriticality] = useState<"unknown" | "potentially_critical" | "critical" | "noncritical">("unknown");
  const [duration, setDuration] = useState("1");
  const [relationshipIds, setRelationshipIds] = useState<string[]>([]);
  const [relationshipSearch, setRelationshipSearch] = useState("");
  const [affectedActivityIds, setAffectedActivityIds] = useState<string[]>(schedule.activities.slice(0, 1).map(activity => activity.id));
  const [preview, setPreview] = useState<IssueFragnetProposal | null>(null);
  const [importRows, setImportRows] = useState<ExcelIssueRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  if (view !== "issues") return null;
  if (!isAuthenticated) return <section className="issue-log-panel"><div className="issue-log-heading"><div><p className="eyebrow">PLANNER ISSUE LOG</p><h2>سجل القضايا المؤثر في البرنامج</h2><p>سجّل الواقعة أولاً ثم راجع Fragnet المقترح قبل إضافته إلى نسخة TIA مستقلة.</p></div><ClipboardList size={24} /></div><div className="issue-log-login"><LogIn size={19} /><span>سجّل الدخول لحفظ قضايا المشروع وسجل مراجعة Fragnet بشكل آمن.</span><Button className="run-button" onClick={startLogin}>تسجيل الدخول</Button></div></section>;

  const toggleActivity = (id: string) => setAffectedActivityIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleRelationship = (id: string) => setRelationshipIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const relationshipOptions = useMemo(() => schedule.relationships.map(relationship => {
    const predecessor = schedule.activities.find(activity => activity.id === relationship.predecessorId);
    const successor = schedule.activities.find(activity => activity.id === relationship.successorId);
    const searchText = `${relationship.id} ${relationship.predecessorId} ${predecessor?.name ?? ""} ${relationship.successorId} ${successor?.name ?? ""} ${relationship.type}`.toLowerCase();
    return { relationship, predecessor, successor, searchText };
  }).filter(option => !relationshipSearch.trim() || option.searchText.includes(relationshipSearch.trim().toLowerCase())), [relationshipSearch, schedule.activities, schedule.relationships]);
  const saveRequirements = [
    { label: "رقم واقعة", done: Boolean(issueNo.trim()) },
    { label: "عنوان واضح", done: Boolean(title.trim()) },
    { label: "تاريخ الواقعة", done: Boolean(occurrenceDate) },
    { label: "مدة مقترحة أكبر من صفر", done: Number(duration) > 0 },
    { label: "نقطة ربط واحدة على الأقل", done: relationshipIds.length > 0 },
    { label: "نشاط متأثر واحد على الأقل", done: affectedActivityIds.length > 0 },
    { label: "وصف فني (10 أحرف على الأقل)", done: description.trim().length >= 10 },
    { label: "ملخص أثر (5 أحرف على الأقل)", done: impactSummary.trim().length >= 5 },
    { label: "مرجع أو دليل (3 أحرف على الأقل)", done: referenceNotes.trim().length >= 3 },
  ];
  const missingRequirements = saveRequirements.filter(item => !item.done).map(item => item.label);
  const canCreate = missingRequirements.length === 0;
  const saveIssue = () => {
    const createInput = (relationshipId: string, index: number) => ({
      issueNo: relationshipIds.length === 1 ? issueNo.trim() : `${issueNo.trim()}-${String(index + 1).padStart(2, "0")}`,
      title: relationshipIds.length === 1 ? title.trim() : `${title.trim()} — نقطة ربط ${relationshipId}`,
      description: description.trim(), impactSummary: impactSummary.trim(), referenceNotes: referenceNotes.trim(), occurrenceDate,
      reportedBy: reportedBy.trim() || undefined, responsibleParty: responsibility, delayCause: cause, affectedActivityIds,
      replacedRelationshipId: relationshipId, proposedDurationDays: Number(duration), criticality,
    });
    if (relationshipIds.length === 1) { create.mutate({ projectKey: schedule.id, ...createInput(relationshipIds[0], 0) }); return; }
    importBatch.mutate({ projectKey: schedule.id, issues: relationshipIds.map(createInput) });
  };
  const handleExcel = async (file?: File) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setImportRows([]); setImportErrors(["اختر ملف Excel بصيغة XLSX أو XLS فقط."]); return; }
    try {
      const result = parseIssueRegisterExcel(await file.arrayBuffer(), schedule);
      setImportRows(result.errors.length ? [] : result.rows);
      setImportErrors(result.errors);
      if (result.errors.length) toast.error(`لا يمكن استيراد الملف: ${result.errors.length} خطأ يحتاج تصحيحاً.`);
      else toast.success(`تمت معاينة ${result.rows.length} قضية. راجعها ثم أكد الحفظ.`);
    } catch { setImportRows([]); setImportErrors(["تعذر قراءة ملف Excel. تحقق من أن الملف غير محمي ومن استخدام القالب المعتمد."]); }
  };
  const exportIssues = () => exportIssueRegisterExcel((issues.data ?? []).map(issue => ({ issueNo: issue.issueNo, title: issue.title, occurrenceDate: dateInput(issue.occurrenceDate), reportedBy: issue.reportedBy ?? undefined, responsibleParty: issue.responsibleParty, delayCause: issue.delayCause, criticality: issue.criticality, proposedDurationDays: Number(issue.proposedDurationDays), replacedRelationshipId: issue.replacedRelationshipId, affectedActivityIds: parseAffectedActivities(issue.affectedActivityIds), description: issue.description, impactSummary: issue.impactSummary, referenceNotes: issue.referenceNotes, status: issue.status })));

  return <section className="issue-log-panel"><div className="issue-log-heading"><div><p className="eyebrow">PLANNER ISSUE LOG</p><h2>سجل الواقعة المؤثرة في البرنامج</h2><p>سجّل ما حدث أولاً. بعدها اختَر نقطة أو نقاط الربط الفعلية من البرنامج المستورد، وراجع مقترح Fragnet قبل إضافته إلى نسخة TIA مستقلة.</p></div><ClipboardList size={24} /></div>
    <div className="issue-log-caution"><ShieldCheck size={17} /><span>النتيجة مقترح فني قابل للمراجعة وليست تقرير استحقاق أو تعديل مباشر لبرنامج P6.</span></div>
    <div className="issue-exchange"><div><Table2 size={20} /><div><b>تبادل Excel مضبوط</b><span>حمّل القالب أولاً. يتحقق التطبيق من الصفوف والأعمدة ومعرفات الأنشطة والعلاقات قبل حفظ أي قضية.</span></div></div><div className="issue-exchange-actions"><Button variant="outline" onClick={downloadIssueImportTemplate}><Download size={16} />قالب Excel</Button><Button variant="outline" disabled={!issues.data?.length} onClick={exportIssues}><Download size={16} />تصدير السجل</Button><input ref={importInputRef} type="file" accept=".xlsx,.xls" hidden onChange={event => { handleExcel(event.target.files?.[0]); event.currentTarget.value = ""; }} /><Button variant="outline" onClick={() => importInputRef.current?.click()}><FileUp size={16} />استيراد Excel</Button></div></div>
    {(importErrors.length || importRows.length) ? <div className={`issue-import-preview ${importErrors.length ? "has-errors" : ""}`}>{importErrors.length ? <><b><AlertTriangle size={16} />أخطاء الاستيراد — لم يُحفظ أي صف</b><ul>{importErrors.slice(0, 10).map(error => <li key={error}>{error}</li>)}</ul>{importErrors.length > 10 ? <small>و{importErrors.length - 10} أخطاء إضافية.</small> : null}</> : <><b><CheckCircle2 size={16} />معاينة صالحة: {importRows.length} قضية</b><span>{importRows.slice(0, 4).map(row => `${row.issueNo} — ${row.title}`).join(" · ")}{importRows.length > 4 ? " …" : ""}</span><Button className="run-button" disabled={importBatch.isPending} onClick={() => importBatch.mutate({ projectKey: schedule.id, issues: importRows.map(({ rowNumber: _rowNumber, ...issue }) => issue) })}><FileUp size={16} />تأكيد استيراد الدفعة</Button></>}</div> : null}
    <div className="issue-save-guide"><div><b>قبل الحفظ: ما الذي ينقصني؟</b><span>لن يتفعّل زر الحفظ إلا بعد استكمال العناصر المطلوبة. لا توجد شروط مخفية.</span></div><div className="issue-requirements">{saveRequirements.map(item => <span key={item.label} className={item.done ? "complete" : "pending"}>{item.done ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{item.label}</span>)}</div></div>
    <div className="issue-form">
      <div><Label>رقم القضية</Label><Input value={issueNo} onChange={event => setIssueNo(event.target.value)} placeholder="ISS-001" /></div>
      <div><Label>عنوان القضية</Label><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="تعليمات تغيير متأخرة" /></div>
      <div><Label>تاريخ الواقعة</Label><Input type="date" dir="ltr" value={occurrenceDate} onChange={event => setOccurrenceDate(event.target.value)} /></div>
      <div><Label>أبلغ عنها</Label><Input value={reportedBy} onChange={event => setReportedBy(event.target.value)} placeholder="اسم البلانر / الجهة" /></div>
      <div><Label>المسؤولية الظاهرة (من المستندات)</Label><Select value={responsibility} onValueChange={value => setResponsibility(value as typeof responsibility)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="undetermined">غير محددة بعد</SelectItem><SelectItem value="employer">صاحب العمل</SelectItem><SelectItem value="contractor">المقاول</SelectItem><SelectItem value="engineer">المهندس</SelectItem><SelectItem value="third_party">طرف ثالث</SelectItem></SelectContent></Select><small>من يبدو مسؤولاً مبدئياً من الخطابات أو المحاضر؛ ليس حكماً نهائياً.</small></div>
      <div><Label>السبب المستخدم في التحليل (سبب مبدئي)</Label><Select value={cause} onValueChange={value => setCause(value as typeof cause)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="neutral">قيد التحقق / محايد</SelectItem><SelectItem value="employer">من جهة صاحب العمل</SelectItem><SelectItem value="contractor">من جهة المقاول</SelectItem></SelectContent></Select><small>يحدد تصنيف الحدث للحساب والسرد، ولا يثبت الاستحقاق وحده.</small></div>
      <div><Label>تصنيف الحرجية</Label><Select value={criticality} onValueChange={value => setCriticality(value as typeof criticality)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">قيد التقييم</SelectItem><SelectItem value="potentially_critical">مرشح للحرجية</SelectItem><SelectItem value="critical">حرج</SelectItem><SelectItem value="noncritical">غير حرج</SelectItem></SelectContent></Select></div>
      <div><Label>مدة Fragnet المقترحة (أيام عمل)</Label><Input type="number" min="0.01" max="3650" step="0.25" value={duration} onChange={event => setDuration(event.target.value)} /></div>
      <div className="issue-form-wide"><div className="issue-field-heading"><Label>نقطة الربط التي سيدخل فيها Fragnet</Label><b>{relationshipIds.length} مختارة</b></div><p className="issue-field-help">هذه هي علاقة السهم بين نشاط سابق ونشاط لاحق. تظهر من البرنامج الذي رفعته أنت، وليست قائمة ثابتة. إذا اخترت أكثر من نقطة، يحفظ النظام قضية ومقترح Fragnet مستقلين لكل نقطة حتى لا يختلط المسار.</p><Input value={relationshipSearch} onChange={event => setRelationshipSearch(event.target.value)} placeholder="ابحث برقم العلاقة أو Activity ID أو اسم النشاط…" /><div className="issue-relationship-list">{relationshipOptions.length ? relationshipOptions.map(({ relationship, predecessor, successor }) => <label key={relationship.id} className={relationshipIds.includes(relationship.id) ? "selected" : ""}><input type="checkbox" checked={relationshipIds.includes(relationship.id)} onChange={() => toggleRelationship(relationship.id)} /><span><b>{relationship.id} · {relationship.type}</b><em>{relationship.predecessorId} — {predecessor?.name ?? "نشاط غير مقروء"}</em><i>←</i><em>{relationship.successorId} — {successor?.name ?? "نشاط غير مقروء"}</em></span></label>) : <p>لا توجد علاقة مطابقة للبحث. راجع برنامج P6 المستورد أو امسح البحث.</p>}</div></div>
      <div className="issue-form-wide"><Label>الأنشطة المتأثرة (للتوثيق والمراجعة)</Label><p className="issue-field-help">اختيار الأنشطة هنا يوضح نطاق الواقعة للمراجع. أما موضع إدراج الـFragnet فيحدده اختيار «نقطة الربط» أعلاه.</p><div className="issue-activity-pills">{schedule.activities.map(activity => <label key={activity.id}><input type="checkbox" checked={affectedActivityIds.includes(activity.id)} onChange={() => toggleActivity(activity.id)} /><span>{activity.id} — {activity.name}</span></label>)}</div></div>
      <div className="issue-form-wide"><Label>الوصف الفني</Label><Textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="اشرح الوقائع الفنية وما الذي يجعل العلاقة أو الأنشطة المختارة مناسبة للتحليل…" /></div>
      <div className="issue-form-wide"><Label>ملخص الأثر المتوقع</Label><Textarea rows={2} value={impactSummary} onChange={event => setImpactSummary(event.target.value)} placeholder="اشرح الأثر المتوقع على التسلسل أو المدة أو الحرجية. لا يغني ذلك عن حساب TIA." /></div>
      <div className="issue-form-wide"><Label>المراجع والأدلة</Label><Textarea rows={2} value={referenceNotes} onChange={event => setReferenceNotes(event.target.value)} placeholder="اذكر رقم الخطاب أو المحضر أو الصورة أو بند العقد أو رابط الدليل…" /></div>
    </div>
    <div className="issue-log-actions"><p><AlertTriangle size={16} /> {canCreate ? relationshipIds.length > 1 ? `سيتم حفظ ${relationshipIds.length} قضايا مستقلة، واحدة لكل نقطة ربط، ثم تراجع كل Fragnet على حدة.` : "راجع نقطة الربط والمدة قبل الحفظ؛ تعديل الأثر بعد التطبيق يكون بقضية تصحيحية جديدة لحفظ التدقيق." : `أكمل الآتي لتفعيل الحفظ: ${missingRequirements.join("، ")}`}</p><Button className="run-button" disabled={create.isPending || importBatch.isPending || !canCreate} onClick={saveIssue}><Plus size={16} />{relationshipIds.length > 1 ? `حفظ ${relationshipIds.length} مقترحات منفصلة` : "حفظ القضية ومقترح Fragnet"}</Button></div>
    {preview ? <div className="issue-preview"><div><FileCog size={19} /><div><b>مقترح جاهز للمراجعة: {preview.id}</b><span>{preview.title} · {preview.durationDays} يوم · علاقة {preview.relationshipId}</span></div></div><p>الأنشطة المتأثرة: {preview.affectedActivityIds.join("، ")} · المسؤولية: {responsibilityLabel[preview.responsibility]} · السبب: {causeLabel[preview.cause]}</p><Button className="run-button" disabled={recordApplied.isPending} onClick={() => { const row = issues.data?.find(item => item.fragnetProposalJson === JSON.stringify(preview)); if (row) recordApplied.mutate({ id: row.id }); else toast.error("أعد تجهيز القضية من صف السجل قبل التطبيق."); }}><CheckCircle2 size={16} />اعتماد وإدراج في TIA</Button></div> : null}
    <div className="issue-register"><div className="issue-register-title"><b>سجل القضايا المحفوظ</b><span>{issues.data?.length ?? 0} قضية</span></div>{issues.isLoading ? <p>جار تحميل السجل…</p> : issues.data?.length ? issues.data.map(issue => { const proposal = parseProposal(issue.fragnetProposalJson); const isPreviewed = preview?.id === proposal?.id; return <article key={issue.id} className={`issue-row status-${issue.status}`}><div className="issue-row-main"><b>{issue.issueNo} — {issue.title}</b><span>{new Date(issue.occurrenceDate).toLocaleDateString("ar-EG", { timeZone: "UTC" })} · {statusLabel[issue.status]} · {criticalityLabel[issue.criticality]}</span><small>{issue.description}</small><small><b>ملخص الأثر:</b> {issue.impactSummary}</small><small><b>المراجع:</b> {issue.referenceNotes}</small></div><div className="issue-row-meta"><span>{responsibilityLabel[issue.responsibleParty]} · {causeLabel[issue.delayCause]}</span><span>{String(issue.proposedDurationDays)} يوم · علاقة {issue.replacedRelationshipId}</span></div><div className="issue-row-actions">{issue.status === "open" ? <><Button size="sm" variant="outline" disabled={prepare.isPending} onClick={() => prepare.mutate({ id: issue.id })}><FileCog size={15} />تجهيز Fragnet</Button><Button size="sm" variant="ghost" disabled={close.isPending} onClick={() => close.mutate({ id: issue.id, status: "rejected" })}><XCircle size={15} />رفض</Button></> : null}{issue.status === "ready_for_fragnet" && proposal ? <Button size="sm" className="run-button" disabled={recordApplied.isPending} onClick={() => { setPreview(proposal); if (isPreviewed) recordApplied.mutate({ id: issue.id }); else toast.success("راجع بطاقة المقترح ثم اضغط اعتماد وإدراج في TIA."); }}><CheckCircle2 size={15} />{isPreviewed ? "اعتماد وتطبيق" : "عرض المقترح"}</Button> : null}{issue.status === "open" || issue.status === "ready_for_fragnet" ? <Button size="sm" variant="ghost" disabled={close.isPending} onClick={() => close.mutate({ id: issue.id, status: "closed" })}>إغلاق</Button> : null}</div></article>; }) : <p className="issue-empty">لا توجد قضايا بعد. ابدأ بتسجيل واقعة من محضر أو سجل موقع ثم راجع Fragnet المقترح.</p>}</div>
  </section>;
}
