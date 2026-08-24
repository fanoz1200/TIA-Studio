import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, FileCheck2, FlagTriangleRight, Link2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { Schedule } from "@/lib/cpm";

type SourceStatus = "sourced" | "to_enrich" | "review_required" | "rejected";
const sourceLabels: Record<SourceStatus, string> = { sourced: "مصدر موثق", to_enrich: "يحتاج استكمال", review_required: "مراجعة مطلوبة", rejected: "مرفوض" };
const dateOnly = (value?: Date | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const shortDate = (value?: Date | null) => value ? new Date(value).toLocaleDateString("ar-EG") : "غير محدد";

function SourceBadge({ status }: { status: SourceStatus }) {
  const variant = status === "sourced" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant}>{sourceLabels[status]}</Badge>;
}

export function ClaimConsolePanel({ view, schedule, isAuthenticated, onNavigate, onActiveClaimChange }: { view: string; schedule: Schedule; isAuthenticated: boolean; onNavigate: (view: "notices" | "report") => void; onActiveClaimChange: (claimKey: string, narrative: string) => void }) {
  const utils = trpc.useUtils();
  const projectInput = useMemo(() => ({ projectKey: schedule.id }), [schedule.id]);
  const consoleData = trpc.claimConsole.list.useQuery(projectInput, { enabled: isAuthenticated && view === "claimConsole" });
  const invalidate = () => utils.claimConsole.list.invalidate(projectInput);
  const [contract, setContract] = useState({ contractTitle: "", contractForm: "", contractEdition: "", specialConditionsReference: "", governingLaw: "", claimClauseReference: "", noticeTriggerDescription: "", sourceReference: "", sourceStatus: "to_enrich" as SourceStatus, reviewNotes: "" });
  const [risk, setRisk] = useState({ riskKey: "RISK-", title: "", description: "", identifiedDate: "", ownerRole: "", sourceReference: "", sourceStatus: "to_enrich" as SourceStatus, status: "open" as "open" | "monitoring" | "escalated" | "closed", linkedPlannerIssueId: "none", reviewNotes: "" });
  const [candidate, setCandidate] = useState({ candidateKey: "CC-", title: "", riskId: "none", plannerIssueLogId: "none", claimChainId: "none", contractClauseReference: "", basisSummary: "", sourceReference: "", sourceStatus: "to_enrich" as SourceStatus, status: "draft" as "draft" | "under_review" | "ready_for_notice" | "linked_to_claim" | "closed", reviewNotes: "" });
  const [deadline, setDeadline] = useState({ claimCandidateId: "none", deadlineKey: "DL-", title: "", deadlineKind: "notice" as "notice" | "particulars" | "substantiation" | "other", calculationMode: "manual_date" as "manual_date" | "calendar_days", referenceDate: "", calendarDays: "", dueDate: "", ruleDescription: "", sourceReference: "", sourceStatus: "to_enrich" as SourceStatus, status: "unconfigured" as "unconfigured" | "tracking" | "review_required" | "completed" | "superseded", reviewNotes: "" });

  useEffect(() => {
    const profile = consoleData.data?.profile;
    if (!profile) return;
    setContract({ contractTitle: profile.contractTitle ?? "", contractForm: profile.contractForm ?? "", contractEdition: profile.contractEdition ?? "", specialConditionsReference: profile.specialConditionsReference ?? "", governingLaw: profile.governingLaw ?? "", claimClauseReference: profile.claimClauseReference ?? "", noticeTriggerDescription: profile.noticeTriggerDescription ?? "", sourceReference: profile.sourceReference ?? "", sourceStatus: profile.sourceStatus, reviewNotes: profile.reviewNotes ?? "" });
  }, [consoleData.data?.profile]);

  const saveContract = trpc.claimConsole.saveContractProfile.useMutation({ onSuccess: () => { invalidate(); toast.success("تم حفظ ملف العقد كبيانات مرجعية قابلة للمراجعة."); }, onError: error => toast.error(error.message) });
  const createRisk = trpc.claimConsole.createRisk.useMutation({ onSuccess: () => { invalidate(); setRisk(previous => ({ ...previous, title: "", description: "", sourceReference: "", reviewNotes: "", linkedPlannerIssueId: "none" })); toast.success("تمت إضافة المخاطرة إلى سجل المراجعة."); }, onError: error => toast.error(error.message) });
  const createCandidate = trpc.claimConsole.createCandidate.useMutation({ onSuccess: () => { invalidate(); setCandidate(previous => ({ ...previous, title: "", basisSummary: "", sourceReference: "", reviewNotes: "", riskId: "none", plannerIssueLogId: "none", claimChainId: "none" })); toast.success("تم ربط مرشح المطالبة دون تقرير استحقاق تلقائي."); }, onError: error => toast.error(error.message) });
  const createDeadline = trpc.claimConsole.createDeadline.useMutation({ onSuccess: () => { invalidate(); setDeadline(previous => ({ ...previous, title: "", ruleDescription: "", sourceReference: "", reviewNotes: "", dueDate: "", calendarDays: "" })); toast.success("تم حفظ الموعد كمؤشر مراجعة فقط."); }, onError: error => toast.error(error.message) });

  if (view !== "claimConsole") return null;
  if (!isAuthenticated) return <section className="workflow-panel"><div className="workflow-heading"><div><p className="eyebrow">Claim Console</p><h2>ملف العقد وسجل المخاطر</h2><p>سجّل الدخول لحفظ هذا السجل في مساحة المشروع ومشاركته في مسار المراجعة. لا يتم إدخال أي بيانات تجريبية تلقائياً.</p></div><ShieldAlert size={30} /></div></section>;

  const data = consoleData.data;
  const openRisks = data?.risks.filter(item => item.status !== "closed").length ?? 0;
  const reviewDeadlines = data?.deadlines.filter(item => item.status === "review_required" || item.sourceStatus !== "sourced").length ?? 0;
  const handoffToClaim = (claimChainId: number | null) => {
    const chain = data?.chains.find(item => item.id === claimChainId);
    if (!chain) {
      toast.error("اربط مرشح المطالبة بسلسلة Claim محفوظة أولاً قبل الانتقال إلى Notice أو التقرير.");
      return;
    }
    onActiveClaimChange(chain.claimKey, "");
    onNavigate("notices");
    toast.message("تم اختيار سلسلة المطالبة. راجع المصدر والمستلم والتاريخ قبل حفظ أو إرسال أي Notice.");
  };

  return <div className="view-stack claim-console-view" dir="rtl">
    <section className="hero-panel border border-amber-200 bg-amber-50/70 text-slate-900">
      <div className="hero-copy">
        <p className="eyebrow">CLAIM CONSOLE · MVP</p>
        <h1>من المخاطرة إلى الواقعة ثم مرشح المطالبة</h1>
        <p>هذه محطة تنظيم ومراجعة. لا تستنتج التطبيق بنود العقد أو مدد FIDIC ولا تقرر استحقاقاً أو سقوط حق؛ راجع المصدر وتاريخ البدء والمستلم ووسيلة الإرسال قبل أي Notice أو Claim.</p>
      </div>
      <div className="hero-side-grid">
        <div><small>مخاطر مفتوحة</small><strong>{openRisks}</strong></div>
        <div><small>مواعيد تحتاج مراجعة</small><strong>{reviewDeadlines}</strong></div>
        <div><small>ملف العقد</small><strong>{data?.profile?.sourceStatus === "sourced" ? "موثق" : "راجع"}</strong></div>
      </div>
    </section>

    <section className="workflow-panel">
      <div className="workflow-heading"><div><p className="eyebrow">01 · Contract Profile</p><h2>ملف العقد المرجعي للمشروع</h2><p>اكتب المرجع كما هو من العقد أو الشروط الخاصة. الحقول الفارغة تظهر كفجوات وليست قيماً مفترضة.</p></div><FileCheck2 size={28} /></div>
      <div className="form-grid three-col">
        <div><Label htmlFor="cc-contract-title">اسم/عنوان العقد</Label><Input id="cc-contract-title" value={contract.contractTitle} onChange={event => setContract({ ...contract, contractTitle: event.target.value })} /></div>
        <div><Label htmlFor="cc-contract-form">نموذج العقد</Label><Input id="cc-contract-form" placeholder="مثال: وفق النسخة الموقعة" value={contract.contractForm} onChange={event => setContract({ ...contract, contractForm: event.target.value })} /></div>
        <div><Label htmlFor="cc-contract-edition">الإصدار أو النسخة</Label><Input id="cc-contract-edition" value={contract.contractEdition} onChange={event => setContract({ ...contract, contractEdition: event.target.value })} /></div>
        <div><Label htmlFor="cc-special">مرجع الشروط الخاصة</Label><Input id="cc-special" value={contract.specialConditionsReference} onChange={event => setContract({ ...contract, specialConditionsReference: event.target.value })} /></div>
        <div><Label htmlFor="cc-law">القانون الحاكم</Label><Input id="cc-law" value={contract.governingLaw} onChange={event => setContract({ ...contract, governingLaw: event.target.value })} /></div>
        <div><Label htmlFor="cc-clause">مرجع بند المطالبة</Label><Input id="cc-clause" value={contract.claimClauseReference} onChange={event => setContract({ ...contract, claimClauseReference: event.target.value })} /></div>
        <div><Label>حالة المصدر</Label><Select value={contract.sourceStatus} onValueChange={value => setContract({ ...contract, sourceStatus: value as SourceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="span-2"><Label htmlFor="cc-contract-source">مرجع المصدر أو موضعه</Label><Input id="cc-contract-source" placeholder="رقم العقد / الملحق / صفحة أو رابط داخلي" value={contract.sourceReference} onChange={event => setContract({ ...contract, sourceReference: event.target.value })} /></div>
      </div>
      <div className="form-grid two-col mt-4"><div><Label htmlFor="cc-trigger">وصف نقطة بدء الإخطار بحسب النص المراجع</Label><Textarea id="cc-trigger" value={contract.noticeTriggerDescription} onChange={event => setContract({ ...contract, noticeTriggerDescription: event.target.value })} /></div><div><Label htmlFor="cc-contract-review">ملاحظات المراجعة والفجوات</Label><Textarea id="cc-contract-review" value={contract.reviewNotes} onChange={event => setContract({ ...contract, reviewNotes: event.target.value })} /></div></div>
      <Button className="mt-4" onClick={() => saveContract.mutate({ projectKey: schedule.id, ...contract })} disabled={saveContract.isPending}>{saveContract.isPending ? "جارٍ الحفظ..." : "حفظ ملف العقد"}</Button>
    </section>

    <section className="workflow-panel">
      <div className="workflow-heading"><div><p className="eyebrow">02 · Risk Register</p><h2>سجل المخاطر قبل تحولها إلى واقعة</h2><p>المخاطرة مؤشر يمكن رصده؛ لا تصبح واقعة أو سبباً للمطالبة إلا بعد التحقق والربط بالسجل الفني.</p></div><FlagTriangleRight size={28} /></div>
      <div className="form-grid three-col">
        <div><Label htmlFor="cc-risk-key">مفتاح المخاطرة</Label><Input id="cc-risk-key" value={risk.riskKey} onChange={event => setRisk({ ...risk, riskKey: event.target.value })} /></div>
        <div className="span-2"><Label htmlFor="cc-risk-title">عنوان المخاطرة</Label><Input id="cc-risk-title" value={risk.title} onChange={event => setRisk({ ...risk, title: event.target.value })} /></div>
        <div><Label htmlFor="cc-risk-date">تاريخ الرصد</Label><Input id="cc-risk-date" type="date" value={risk.identifiedDate} onChange={event => setRisk({ ...risk, identifiedDate: event.target.value })} /></div>
        <div><Label htmlFor="cc-risk-owner">مالك المتابعة / الدور</Label><Input id="cc-risk-owner" value={risk.ownerRole} onChange={event => setRisk({ ...risk, ownerRole: event.target.value })} /></div>
        <div><Label>ربط بواقعة فنية (اختياري)</Label><Select value={risk.linkedPlannerIssueId} onValueChange={value => setRisk({ ...risk, linkedPlannerIssueId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">لا يوجد بعد</SelectItem>{data?.issues.map(issue => <SelectItem key={issue.id} value={String(issue.id)}>{issue.issueNo} — {issue.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>حالة المصدر</Label><Select value={risk.sourceStatus} onValueChange={value => setRisk({ ...risk, sourceStatus: value as SourceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>حالة المتابعة</Label><Select value={risk.status} onValueChange={value => setRisk({ ...risk, status: value as typeof risk.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">مفتوحة</SelectItem><SelectItem value="monitoring">تحت المراقبة</SelectItem><SelectItem value="escalated">صعّدت للمراجعة</SelectItem><SelectItem value="closed">مغلقة</SelectItem></SelectContent></Select></div>
        <div><Label htmlFor="cc-risk-source">مرجع المصدر</Label><Input id="cc-risk-source" value={risk.sourceReference} onChange={event => setRisk({ ...risk, sourceReference: event.target.value })} /></div>
      </div>
      <div className="form-grid two-col mt-4"><div><Label htmlFor="cc-risk-desc">الوصف</Label><Textarea id="cc-risk-desc" value={risk.description} onChange={event => setRisk({ ...risk, description: event.target.value })} /></div><div><Label htmlFor="cc-risk-review">ملاحظات مراجعة</Label><Textarea id="cc-risk-review" value={risk.reviewNotes} onChange={event => setRisk({ ...risk, reviewNotes: event.target.value })} /></div></div>
      <Button className="mt-4" onClick={() => createRisk.mutate({ projectKey: schedule.id, ...risk, linkedPlannerIssueId: risk.linkedPlannerIssueId === "none" ? null : Number(risk.linkedPlannerIssueId) })} disabled={createRisk.isPending}><Plus size={16} />إضافة مخاطرة</Button>
      <div className="data-table-wrap mt-5"><table><thead><tr><th>المفتاح</th><th>المخاطرة</th><th>الواقعة المرتبطة</th><th>المصدر</th><th>الحالة</th></tr></thead><tbody>{data?.risks.length ? data.risks.map(item => <tr key={item.id}><td>{item.riskKey}</td><td><b>{item.title}</b><small>{item.description}</small></td><td>{item.linkedPlannerIssueId ? `Issue #${item.linkedPlannerIssueId}` : "لم تربط بعد"}</td><td><SourceBadge status={item.sourceStatus} /></td><td>{item.status}</td></tr>) : <tr><td colSpan={5}>لا توجد مخاطر محفوظة للمشروع حتى الآن.</td></tr>}</tbody></table></div>
    </section>

    <section className="workflow-panel">
      <div className="workflow-heading"><div><p className="eyebrow">03 · Issue → Claim Candidate</p><h2>مرشح مطالبة قابل للتتبع</h2><p>الربط هنا يثبت مسار المراجعة بين مخاطر وواقعة وسلسلة مطالبة؛ ولا يحولها تلقائياً إلى Claim مستحق أو Notice جاهز للإرسال.</p></div><Link2 size={28} /></div>
      <div className="form-grid three-col">
        <div><Label htmlFor="cc-candidate-key">مفتاح المرشح</Label><Input id="cc-candidate-key" value={candidate.candidateKey} onChange={event => setCandidate({ ...candidate, candidateKey: event.target.value })} /></div>
        <div className="span-2"><Label htmlFor="cc-candidate-title">عنوان مرشح المطالبة</Label><Input id="cc-candidate-title" value={candidate.title} onChange={event => setCandidate({ ...candidate, title: event.target.value })} /></div>
        <div><Label>المخاطرة</Label><Select value={candidate.riskId} onValueChange={value => setCandidate({ ...candidate, riskId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">غير مرتبطة</SelectItem>{data?.risks.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.riskKey} — {item.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>الواقعة الفنية</Label><Select value={candidate.plannerIssueLogId} onValueChange={value => setCandidate({ ...candidate, plannerIssueLogId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">غير مرتبطة</SelectItem>{data?.issues.map(issue => <SelectItem key={issue.id} value={String(issue.id)}>{issue.issueNo} — {issue.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>سلسلة المطالبة</Label><Select value={candidate.claimChainId} onValueChange={value => setCandidate({ ...candidate, claimChainId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">غير مرتبطة</SelectItem>{data?.chains.map(chain => <SelectItem key={chain.id} value={String(chain.id)}>{chain.claimKey} — {chain.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="cc-candidate-clause">مرجع البند</Label><Input id="cc-candidate-clause" value={candidate.contractClauseReference} onChange={event => setCandidate({ ...candidate, contractClauseReference: event.target.value })} /></div>
        <div><Label>حالة المصدر</Label><Select value={candidate.sourceStatus} onValueChange={value => setCandidate({ ...candidate, sourceStatus: value as SourceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>حالة المرشح</Label><Select value={candidate.status} onValueChange={value => setCandidate({ ...candidate, status: value as typeof candidate.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">مسودة</SelectItem><SelectItem value="under_review">تحت المراجعة</SelectItem><SelectItem value="ready_for_notice">جاهز لمراجعة Notice</SelectItem><SelectItem value="linked_to_claim">مرتبط بسلسلة Claim</SelectItem><SelectItem value="closed">مغلق</SelectItem></SelectContent></Select></div>
      </div>
      <div className="form-grid two-col mt-4"><div><Label htmlFor="cc-candidate-basis">ملخص الأساس والفجوات</Label><Textarea id="cc-candidate-basis" value={candidate.basisSummary} onChange={event => setCandidate({ ...candidate, basisSummary: event.target.value })} /></div><div><Label htmlFor="cc-candidate-review">ملاحظات المراجع</Label><Textarea id="cc-candidate-review" value={candidate.reviewNotes} onChange={event => setCandidate({ ...candidate, reviewNotes: event.target.value })} /></div></div>
      <div className="mt-3"><Label htmlFor="cc-candidate-source">مرجع المصدر</Label><Input id="cc-candidate-source" value={candidate.sourceReference} onChange={event => setCandidate({ ...candidate, sourceReference: event.target.value })} /></div>
      <Button className="mt-4" onClick={() => createCandidate.mutate({ projectKey: schedule.id, ...candidate, riskId: candidate.riskId === "none" ? null : Number(candidate.riskId), plannerIssueLogId: candidate.plannerIssueLogId === "none" ? null : Number(candidate.plannerIssueLogId), claimChainId: candidate.claimChainId === "none" ? null : Number(candidate.claimChainId) })} disabled={createCandidate.isPending}><Plus size={16} />إضافة مرشح المطالبة</Button>
      <div className="data-table-wrap mt-5"><table><thead><tr><th>المفتاح</th><th>المرشح</th><th>الربط</th><th>المصدر</th><th>الحالة</th><th>تسليم للمراجعة</th></tr></thead><tbody>{data?.candidates.length ? data.candidates.map(item => <tr key={item.id}><td>{item.candidateKey}</td><td><b>{item.title}</b><small>{item.basisSummary}</small></td><td>{[item.riskId && `Risk #${item.riskId}`, item.plannerIssueLogId && `Issue #${item.plannerIssueLogId}`, item.claimChainId && `Claim #${item.claimChainId}`].filter(Boolean).join(" · ")}</td><td><SourceBadge status={item.sourceStatus} /></td><td>{item.status}</td><td><Button variant="outline" size="sm" onClick={() => handoffToClaim(item.claimChainId)} disabled={!item.claimChainId}>فتح Notice</Button></td></tr>) : <tr><td colSpan={6}>أضف ربطاً واحداً على الأقل قبل إنشاء مرشح مطالبة.</td></tr>}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 mt-4"><p className="m-0 text-sm text-slate-700">استخدم <b>فتح Notice</b> بعد ربط سلسلة Claim، ثم ارجع إلى تقرير المطالبة لتصدير Fact Pack أو Full Claim V1 من البيانات التي راجعتها.</p><Button variant="outline" size="sm" onClick={() => onNavigate("report")}>فتح Fact Pack / Full Claim</Button></div>
    </section>

    <section className="workflow-panel">
      <div className="workflow-heading"><div><p className="eyebrow">04 · Configurable Deadline Tracker</p><h2>متابع موعد يحتاج مراجعة عقدية</h2><p>إما تاريخ يدوي موثق أو تاريخ مرجعي + عدد أيام تقويمية أدخله المستخدم. «تجاوز الموعد» لا يساوي سقوط الحق في هذا البرنامج.</p></div><BellRing size={28} /></div>
      <div className="alert-strip warning"><AlertTriangle size={18} />لا يوجد 28 أو 42 أو 84 يوماً ثابتاً هنا. راجع نص العقد والشروط الخاصة وتاريخ العلم ووسيلة الإرسال قبل إنشاء Notice.</div>
      <div className="form-grid three-col mt-4">
        <div><Label>مرشح المطالبة</Label><Select value={deadline.claimCandidateId} onValueChange={value => setDeadline({ ...deadline, claimCandidateId: value })}><SelectTrigger><SelectValue placeholder="اختَر المرشح" /></SelectTrigger><SelectContent><SelectItem value="none">اختَر مرشحاً محفوظاً</SelectItem>{data?.candidates.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.candidateKey} — {item.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="cc-deadline-key">مفتاح الموعد</Label><Input id="cc-deadline-key" value={deadline.deadlineKey} onChange={event => setDeadline({ ...deadline, deadlineKey: event.target.value })} /></div>
        <div><Label htmlFor="cc-deadline-title">عنوان الموعد</Label><Input id="cc-deadline-title" value={deadline.title} onChange={event => setDeadline({ ...deadline, title: event.target.value })} /></div>
        <div><Label>نوع الموعد</Label><Select value={deadline.deadlineKind} onValueChange={value => setDeadline({ ...deadline, deadlineKind: value as typeof deadline.deadlineKind })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="notice">Notice</SelectItem><SelectItem value="particulars">Particulars</SelectItem><SelectItem value="substantiation">Substantiation</SelectItem><SelectItem value="other">آخر</SelectItem></SelectContent></Select></div>
        <div><Label>طريقة الإدخال</Label><Select value={deadline.calculationMode} onValueChange={value => setDeadline({ ...deadline, calculationMode: value as typeof deadline.calculationMode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual_date">تاريخ يدوي موثق</SelectItem><SelectItem value="calendar_days">تاريخ مرجعي + أيام تقويمية</SelectItem></SelectContent></Select></div>
        <div><Label>حالة المتابعة</Label><Select value={deadline.status} onValueChange={value => setDeadline({ ...deadline, status: value as typeof deadline.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unconfigured">غير مهيأ</SelectItem><SelectItem value="tracking">قيد المتابعة</SelectItem><SelectItem value="review_required">مراجعة مطلوبة</SelectItem><SelectItem value="completed">مكتمل</SelectItem><SelectItem value="superseded">استبدل</SelectItem></SelectContent></Select></div>
        {deadline.calculationMode === "manual_date" ? <div><Label htmlFor="cc-due-date">التاريخ النهائي اليدوي</Label><Input id="cc-due-date" type="date" value={deadline.dueDate} onChange={event => setDeadline({ ...deadline, dueDate: event.target.value })} /></div> : <><div><Label htmlFor="cc-reference-date">التاريخ المرجعي</Label><Input id="cc-reference-date" type="date" value={deadline.referenceDate} onChange={event => setDeadline({ ...deadline, referenceDate: event.target.value })} /></div><div><Label htmlFor="cc-calendar-days">عدد الأيام التقويمية</Label><Input id="cc-calendar-days" type="number" min="0" value={deadline.calendarDays} onChange={event => setDeadline({ ...deadline, calendarDays: event.target.value })} /></div></>}
        <div><Label>حالة المصدر</Label><Select value={deadline.sourceStatus} onValueChange={value => setDeadline({ ...deadline, sourceStatus: value as SourceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="form-grid two-col mt-4"><div><Label htmlFor="cc-deadline-rule">القاعدة/السبب كما هو موثق</Label><Textarea id="cc-deadline-rule" value={deadline.ruleDescription} onChange={event => setDeadline({ ...deadline, ruleDescription: event.target.value })} /></div><div><Label htmlFor="cc-deadline-review">ملاحظات مراجعة</Label><Textarea id="cc-deadline-review" value={deadline.reviewNotes} onChange={event => setDeadline({ ...deadline, reviewNotes: event.target.value })} /></div></div>
      <div className="mt-3"><Label htmlFor="cc-deadline-source">مرجع المصدر</Label><Input id="cc-deadline-source" value={deadline.sourceReference} onChange={event => setDeadline({ ...deadline, sourceReference: event.target.value })} /></div>
      <Button className="mt-4" onClick={() => { if (deadline.claimCandidateId === "none") return toast.error("اختَر مرشح مطالبة أولاً."); createDeadline.mutate({ projectKey: schedule.id, ...deadline, claimCandidateId: Number(deadline.claimCandidateId), calendarDays: deadline.calendarDays ? Number(deadline.calendarDays) : null, dueDate: deadline.dueDate || null, referenceDate: deadline.referenceDate || null }); }} disabled={createDeadline.isPending}><Plus size={16} />حفظ مؤشر الموعد</Button>
      <div className="data-table-wrap mt-5"><table><thead><tr><th>الموعد</th><th>المرشح</th><th>التاريخ</th><th>المصدر</th><th>الحالة</th></tr></thead><tbody>{data?.deadlines.length ? data.deadlines.map(item => <tr key={item.id}><td><b>{item.title}</b><small>{item.deadlineKey} · {item.deadlineKind}</small></td><td>{data.candidates.find(candidateItem => candidateItem.id === item.claimCandidateId)?.candidateKey ?? `#${item.claimCandidateId}`}</td><td>{shortDate(item.dueDate)}<small>{item.calculationMode === "calendar_days" && item.referenceDate ? `${dateOnly(item.referenceDate)} + ${item.calendarDays} يوم` : "تاريخ يدوي"}</small></td><td><SourceBadge status={item.sourceStatus} /></td><td>{item.status}</td></tr>) : <tr><td colSpan={5}>لا توجد مؤشرات مواعيد. لا تضف موعداً قبل توثيق قاعدته ومصدره.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
