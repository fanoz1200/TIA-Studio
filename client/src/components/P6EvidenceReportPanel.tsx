import React, { useMemo, useRef, useState } from "react";
import { CircleHelp, Download, FileCheck2, FileCode2, FileText, FolderTree, LoaderCircle, LogIn, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { importP6XmlSchedule, type P6XmlImportSummary } from "@/lib/p6-xml";
import { calculateFinancialImpact, getFragnetDelayDuration, resourceAssignmentsForEvent, type Fragnet, type Schedule, type TiaResult, type WindowTiaResult } from "@/lib/cpm";
import { exportClaimDocx, exportClaimPdf, type ClaimReportPayload, type ClaimTemplateDraft } from "@/lib/claim-export";
import { ScheduleComparisonPanel } from "@/components/ScheduleComparisonPanel";
import { evaluateWorkflowReadiness, workflowReadinessSummary, type WorkflowCheckState } from "@/lib/workflow-validation";

type View = "guided" | "schedule" | "event" | "analysis" | "report" | "overview" | "windows" | "methods" | "financial" | "notices" | "review" | "members" | "compare" | "resources" | "learning" | "issues";
type EvidenceType = "correspondence" | "instruction" | "drawing" | "programme" | "photo" | "report" | "other";

const initialTemplate: ClaimTemplateDraft = {
  title: "إشعار مطالبة بتمديد مدة",
  recipient: "المهندس / ممثل صاحب العمل",
  contractReference: "مرجع العقد: يحدد عند الإصدار",
  introduction: "إشارة إلى برنامج العمل المعتمد وإلى وقائع أحداث التأخير المبينة أدناه، يقدم المقاول هذا الإشعار الفني لدعم مراجعة الأثر الزمني.",
  entitlementPosition: "يُطلب تقييم الاستحقاق وفق العقد والإشعارات والأدلة. التحليل الزمني يدعم تقييم الأثر ولا يحل محل الرأي القانوني أو قرار الجهة المخولة.",
  reliefRequested: "يُطلب اعتماد تمديد للمدة بما يعادل الأثر الزمني المحدد في التحليل، مع حفظ الحقوق التعاقدية ذات الصلة.",
  closing: "يرجى دراسة المستند والمرفقات وإصدار القرار وفق الإجراءات التعاقدية المعتمدة.",
};

function fileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة المرفق."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function sourceLabel(source?: Schedule["source"]) {
  return source === "p6-xml" ? "P6 XML" : source === "xer" ? "P6 XER" : source?.toUpperCase() || "MANUAL";
}

export function P6EvidenceReportPanel({
  view,
  schedule,
  events,
  selectedEvent,
  activeResult,
  narrative,
  claimKey: activeClaimKey,
  isAuthenticated,
  onScheduleImported,
}: {
  view: View;
  schedule: Schedule;
  events: Fragnet[];
  selectedEvent: Fragnet | null;
  activeResult: TiaResult | WindowTiaResult | null;
  narrative: string;
  claimKey?: string;
  isAuthenticated: boolean;
  onScheduleImported: (schedule: Schedule, summary: P6XmlImportSummary) => void;
}) {
  const xmlInput = useRef<HTMLInputElement>(null);
  const evidenceInput = useRef<HTMLInputElement>(null);
  const [xmlSummary, setXmlSummary] = useState<P6XmlImportSummary | null>(null);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("correspondence");
  const [evidenceDate, setEvidenceDate] = useState("");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [template, setTemplate] = useState<ClaimTemplateDraft>(initialTemplate);
  const [isImporting, setIsImporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"docx" | "pdf" | null>(null);
  const evidence = trpc.evidence.list.useQuery({ projectKey: schedule.id, eventKey: selectedEvent?.id ?? "none" }, { enabled: Boolean(selectedEvent) && isAuthenticated && (view === "event" || view === "analysis" || view === "report") });
  const templates = trpc.claimTemplate.list.useQuery(undefined, { enabled: isAuthenticated && view === "report" });
  const claimKey = useMemo(() => activeClaimKey || `${schedule.id}:delay-claim`, [activeClaimKey, schedule.id]);
  const notices = trpc.notice.list.useQuery({ projectKey: schedule.id, claimKey }, { enabled: isAuthenticated && view === "report" });
  const review = trpc.claimReview.get.useQuery({ projectKey: schedule.id, claimKey }, { enabled: isAuthenticated && view === "report" });
  const upload = trpc.evidence.upload.useMutation({ onSuccess: () => { evidence.refetch(); toast.success("تم حفظ الدليل وربطه بالحدث المحدد."); setEvidenceTitle(""); setEvidenceDescription(""); setEvidenceDate(""); } });
  const remove = trpc.evidence.remove.useMutation({ onSuccess: () => evidence.refetch() });
  const saveTemplate = trpc.claimTemplate.create.useMutation({ onSuccess: () => { templates.refetch(); toast.success("تم حفظ قالب المطالبة ضمن حسابك."); } });
  const workflowChecks = useMemo(() => evaluateWorkflowReadiness({ schedule, selectedEvent, analysis: activeResult, evidenceCount: evidence.data?.length ?? 0, noticeCount: notices.data?.length ?? 0, reviewStatus: review.data?.review.status, isAuthenticated, hasEventResources: resourceAssignmentsForEvent(schedule, selectedEvent).length > 0, templateReady: Boolean(template.title.trim() && template.recipient.trim() && template.contractReference.trim()) }), [activeResult, evidence.data?.length, isAuthenticated, notices.data?.length, review.data?.review.status, schedule, selectedEvent, template.contractReference, template.recipient, template.title]);

  async function importXml(file: File) {
    setIsImporting(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const result = importP6XmlSchedule(await file.text(), file.name);
      setXmlSummary(result.summary);
      onScheduleImported(result.schedule, result.summary);
      toast.success(`تم استيراد P6 XML: ${result.summary.activitiesRead} نشاط، ${result.summary.wbsRead} عنصر WBS، و${result.summary.activitiesWithProgress} نسبة إنجاز.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر قراءة ملف P6 XML."); } finally { setIsImporting(false); }
  }

  async function uploadEvidence(file: File) {
    if (!selectedEvent) { toast.error("اختر أو أنشئ حدث تأخير أولاً لربط الدليل به."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("الحد الأقصى للمرفق هو 10 MB."); return; }
    try {
      await upload.mutateAsync({ projectKey: schedule.id, eventKey: selectedEvent.id, title: evidenceTitle.trim() || file.name, description: evidenceDescription.trim() || undefined, evidenceType, receivedAt: evidenceDate || undefined, fileName: file.name, mimeType: file.type || "application/octet-stream", dataBase64: await fileBase64(file) });
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ المرفق."); }
  }

  function payload(): ClaimReportPayload | null {
    if (!activeResult) { toast.error("شغّل تحليل TIA أولاً لتوليد تقرير المطالبة."); return null; }
    const impactDays = "totalImpactDays" in activeResult ? activeResult.totalImpactDays : activeResult.impactDays;
    const currentEvidence = (evidence.data ?? []).map((item) => ({ title: item.title, fileName: item.fileName, evidenceType: item.evidenceType, description: item.description, receivedAt: item.receivedAt }));
    const eventResources = resourceAssignmentsForEvent(schedule, selectedEvent);
    const financial = calculateFinancialImpact(Math.max(0, impactDays), eventResources, schedule.calendar?.hoursPerDay ?? 8);
    const financialImpact = eventResources.length ? { dailyCost: financial.dailyCost, extensionCost: financial.extensionCost, byResourceType: Object.entries(financial.byResourceType).map(([type, bucket]) => ({ label: type === "labor" ? "عمالة" : type === "nonlabor" ? "معدات / غير عمالة" : type === "material" ? "مواد" : "غير مصنف", dailyCost: bucket.dailyCost, extensionCost: bucket.extensionCost })), warnings: financial.warnings } : undefined;
    return { projectName: schedule.name, scheduleSource: sourceLabel(schedule.source), baselineFinish: activeResult.baseline.completionDate, impactedFinish: activeResult.impacted.completionDate, impactDays, methodology: "Time Impact Analysis (CPM/Fragnet) — TIA Studio", narrative, template, events: events.map((event) => ({ id: event.id, title: event.title, occurrenceDate: event.occurrenceDate, duration: getFragnetDelayDuration(event), cause: event.cause })), evidence: currentEvidence, financialImpact, notices: notices.data?.map(item => ({ noticeNo: item.noticeNo, eventKey: item.eventKey, status: item.computedStatus, narrative: item.narrative, timeImpactDays: Number(item.timeImpactDays), costImpact: Number(item.costImpact), noticeDueDate: item.noticeDueDate })), review: review.data ? { currentStage: review.data.review.currentStage, status: review.data.review.status, auditCount: review.data.audit.length, participants: review.data.participants.map(item => ({ stage: item.stage, reviewerId: item.reviewerId })) } : null, generatedAt: new Date().toISOString() };
  }

  async function exportReport(format: "docx" | "pdf") {
    const output = payload();
    if (!output) return;
    setExportingFormat(format);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (format === "docx") await exportClaimDocx(output);
      else await exportClaimPdf(output);
      toast.success(format === "docx" ? "تم إنشاء ملف Word." : "تم إنشاء ملف PDF.");
    } catch (error) { toast.error(error instanceof Error ? error.message : `تعذر إنشاء ${format === "docx" ? "Word" : "PDF"}.`); } finally { setExportingFormat(null); }
  }

  if (view === "compare") return <ScheduleComparisonPanel currentSchedule={schedule} />;
  if (view === "schedule") return <section className="p6-ops-panel"><div className="p6-ops-copy"><p className="eyebrow">P6 EXTENDED IMPORT</p><h2>بيانات التقدم وWBS من Primavera</h2><p>يدعم المستورد P6 XML عناصر Project وActivity وRelationship وWBS، ويعرض النسب كما وردت دون تحويلها إلى حكم استحقاق.</p><p className="context-tip"><CircleHelp size={15} />ابدأ بنسخة برنامج معتمدة، ثم راجع أعداد الأنشطة والعلاقات وWBS المعروضة بعد الاستيراد قبل تشغيل TIA.</p></div><div className="p6-ops-actions"><Button variant="outline" className="outline-action" disabled={isImporting} title="تُقرأ البيانات محلياً في المتصفح؛ لا يُرفع ملف P6 إلى خدمة تحليل خارجية." onClick={() => xmlInput.current?.click()}>{isImporting ? <LoaderCircle className="animate-spin" size={16} /> : <FileCode2 size={16} />}{isImporting ? "جارِ قراءة الملف…" : "استيراد P6 XML"}</Button><input ref={xmlInput} hidden type="file" accept=".xml,text/xml,application/xml" onChange={(event) => { const file = event.target.files?.[0]; if (file) importXml(file); event.currentTarget.value = ""; }} />{isImporting ? <div className="operation-progress" role="status"><span />يُفكك الهيكل والعلاقات وبيانات الموارد…</div> : null}<div className="p6-stat"><FolderTree size={18} /><span><b>{schedule.wbsNodes?.length ?? 0}</b> عناصر WBS</span></div><div className="p6-stat"><FileCheck2 size={18} /><span><b>{schedule.activities.filter((activity) => activity.percentComplete !== undefined).length}</b> نسب إنجاز</span></div></div>{xmlSummary ? <div className="p6-summary"><b>آخر استيراد XML: {xmlSummary.projectName}</b><span>{xmlSummary.activitiesRead} نشاط · {xmlSummary.relationshipsRead} علاقة · {xmlSummary.wbsRead} WBS · {xmlSummary.activitiesWithProgress} نسبة إنجاز</span></div> : null}</section>;

  if (view === "event" || view === "analysis") return <section className="evidence-panel"><div className="evidence-header"><div><p className="eyebrow">EVIDENCE REGISTER</p><h2>أدلة حدث التأخير</h2><p>{selectedEvent ? `ربط الوثائق بالحدث ${selectedEvent.id}: ${selectedEvent.title}` : "اختر حدثاً من سجل التحليل لربط الأدلة به."}</p></div><Paperclip size={22} /></div>{!isAuthenticated ? <div className="evidence-login"><LogIn size={18} /><div><b>يلزم تسجيل الدخول لحفظ الأدلة</b><p>تُحفظ المرفقات المرتبطة بالأحداث في مساحة خاصة بحسابك، ولا يبدأ أي رفع قبل تسجيل الدخول.</p></div><Button className="run-button" onClick={startLogin}>تسجيل الدخول</Button></div> : selectedEvent ? <><div className="evidence-form"><div><Label>عنوان الدليل</Label><Input value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} placeholder="مثال: خطاب اعتماد الرسومات" /></div><div><Label>نوع الدليل</Label><Select value={evidenceType} onValueChange={(value) => setEvidenceType(value as EvidenceType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="correspondence">مراسلة</SelectItem><SelectItem value="instruction">تعليمات</SelectItem><SelectItem value="drawing">رسومات</SelectItem><SelectItem value="programme">برنامج</SelectItem><SelectItem value="photo">صورة</SelectItem><SelectItem value="report">تقرير</SelectItem><SelectItem value="other">آخر</SelectItem></SelectContent></Select></div><div><Label>تاريخ الاستلام</Label><Input type="date" dir="ltr" value={evidenceDate} onChange={(event) => setEvidenceDate(event.target.value)} /></div><div className="evidence-form-wide"><Label>وصف وسبب الصلة بالحدث</Label><Textarea rows={2} value={evidenceDescription} onChange={(event) => setEvidenceDescription(event.target.value)} /></div></div><div className="evidence-upload-row"><p>تحفظ الملفات في مساحة مرفقات آمنة مرتبطة بحسابك. الحد الأقصى للملف 10 MB.</p><Button className="run-button" disabled={upload.isPending} onClick={() => evidenceInput.current?.click()}><Upload size={16} />إرفاق مستند</Button><input ref={evidenceInput} type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff,.msg,.eml,.txt" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadEvidence(file); event.currentTarget.value = ""; }} /></div><div className="evidence-list">{evidence.isLoading ? <span>جار تحميل سجل الأدلة…</span> : evidence.data?.length ? evidence.data.map((item) => <div className="evidence-row" key={item.id}><FileText size={17} /><div><b>{item.title}</b><span>{item.fileName} · {item.evidenceType} · {item.sizeBytes.toLocaleString()} bytes</span>{item.description ? <small>{item.description}</small> : null}</div><a href={item.storageUrl} target="_blank" rel="noreferrer">فتح</a><button onClick={() => remove.mutate({ id: item.id })}>حذف</button></div>) : <span>لا توجد مستندات مربوطة بهذا الحدث بعد.</span>}</div></> : null}</section>;

  if (view === "report") return <section className="claim-export-panel"><div className="claim-export-header"><div><p className="eyebrow">CLAIM OUTPUT</p><h2>قالب المطالبة وتصدير التقرير</h2><p>حرّر القالب ثم صدّر تقريراً بصيغة Word أو PDF. يُدرج السرد ونتائج TIA وسجل الأحداث وأدلة الحدث المحدد.</p><p className="context-tip"><CircleHelp size={15} />شغّل TIA أولاً، ثم راجع الأثر الزمني والمالي وحالة الاعتماد؛ يحفظ التصدير لقطة من هذه البيانات في لحظة الإنشاء.</p></div><FileText size={22} /></div><WorkflowQualityGate checks={workflowChecks} /><div className="claim-template-grid"><div><Label>اسم القالب</Label><Input value={template.title} onChange={(event) => setTemplate({ ...template, title: event.target.value })} /></div><div><Label>المخاطب</Label><Input value={template.recipient} onChange={(event) => setTemplate({ ...template, recipient: event.target.value })} /></div><div className="claim-template-wide"><Label>مرجع العقد</Label><Input value={template.contractReference} onChange={(event) => setTemplate({ ...template, contractReference: event.target.value })} /></div><div className="claim-template-wide"><Label>التمهيد</Label><Textarea rows={3} value={template.introduction} onChange={(event) => setTemplate({ ...template, introduction: event.target.value })} /></div><div className="claim-template-wide"><Label>الموقف التعاقدي</Label><Textarea rows={3} value={template.entitlementPosition} onChange={(event) => setTemplate({ ...template, entitlementPosition: event.target.value })} /></div><div className="claim-template-wide"><Label>التمديد/الإغاثة المطلوبة</Label><Textarea rows={3} value={template.reliefRequested} onChange={(event) => setTemplate({ ...template, reliefRequested: event.target.value })} /></div><div className="claim-template-wide"><Label>الخاتمة</Label><Textarea rows={2} value={template.closing} onChange={(event) => setTemplate({ ...template, closing: event.target.value })} /></div></div><div className="claim-export-actions">{isAuthenticated ? <Button variant="outline" onClick={() => saveTemplate.mutate({ ...template })} disabled={saveTemplate.isPending}><FileCheck2 size={16} />حفظ القالب</Button> : <Button variant="outline" onClick={startLogin}><LogIn size={16} />تسجيل الدخول لحفظ القالب</Button>}<Button variant="outline" title="ينشئ ملفاً قابلاً للتحرير ويشمل لقطات النتائج الحالية." disabled={exportingFormat !== null} onClick={() => exportReport("docx")}>{exportingFormat === "docx" ? <LoaderCircle className="animate-spin" size={16} /> : <Download size={16} />}{exportingFormat === "docx" ? "جارِ تجهيز Word…" : "تصدير Word"}</Button><Button className="run-button" title="ينشئ نسخة PDF عربية من بيانات المطالبة الحالية." disabled={exportingFormat !== null} onClick={() => exportReport("pdf")}>{exportingFormat === "pdf" ? <LoaderCircle className="animate-spin" size={16} /> : <Download size={16} />}{exportingFormat === "pdf" ? "جارِ تجهيز PDF…" : "تصدير PDF"}</Button></div>{exportingFormat ? <div className="operation-progress" role="status"><span />يتم تجميع السرد والجداول وسجل الأدلة ومراحل الاعتماد…</div> : null}{templates.data?.length ? <div className="saved-templates">قوالب محفوظة: {templates.data.map((item) => <button key={item.id} onClick={() => setTemplate({ title: item.title, recipient: item.recipient ?? "", contractReference: item.contractReference ?? "", introduction: item.introduction ?? "", entitlementPosition: item.entitlementPosition ?? "", reliefRequested: item.reliefRequested ?? "", closing: item.closing ?? "" })}>{item.title}</button>)}</div> : null}</section>;
  return null;
}

function WorkflowQualityGate({ checks }: { checks: ReturnType<typeof evaluateWorkflowReadiness> }) {
  const iconFor = (state: WorkflowCheckState) => state === "pass" ? "✓" : state === "blocked" ? "×" : state === "attention" ? "!" : "i";
  return <section className="workflow-quality-gate" aria-label="قائمة تحقق المطالبة"><header><div><p className="eyebrow">WORKFLOW QUALITY GATE</p><h3>قائمة تحقق قبل التصدير</h3></div><span className="workflow-quality-summary">{workflowReadinessSummary(checks)}</span></header><div className="workflow-check-grid">{checks.map((check) => <article key={check.id} className={`workflow-check workflow-check-${check.state}`}><b aria-hidden="true">{iconFor(check.state)}</b><div><h4>{check.title}</h4><p>{check.detail}</p></div></article>)}</div></section>;
}
