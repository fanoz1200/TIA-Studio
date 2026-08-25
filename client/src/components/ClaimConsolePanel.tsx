import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, FileCheck2, FlagTriangleRight, Link2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppLanguage } from "@/contexts/LanguageContext";
import type { AppLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import type { Schedule } from "@/lib/cpm";

type SourceStatus = "sourced" | "to_enrich" | "review_required" | "rejected";
const sourceLabels: Record<AppLanguage, Record<SourceStatus, string>> = {
  ar: { sourced: "مصدر موثق", to_enrich: "يحتاج استكمال", review_required: "مراجعة مطلوبة", rejected: "مرفوض" },
  en: { sourced: "Verified source", to_enrich: "Needs enrichment", review_required: "Review required", rejected: "Rejected" },
};
export const claimConsoleToastText = (language: AppLanguage) => language === "en" ? {
  contractSaved: "Contract profile saved as reviewable reference data.",
  riskAdded: "Risk added to the review register.",
  candidateLinked: "Claim candidate linked without an automatic entitlement finding.",
  deadlineSaved: "Deadline saved as a review indicator only.",
  handoffMissing: "Link the claim candidate to a saved Claim chain before opening Notice or the report.",
  handoffSelected: "Claim chain selected. Review the source, recipient and date before saving or sending any Notice.",
} : {
  contractSaved: "تم حفظ ملف العقد كبيانات مرجعية قابلة للمراجعة.",
  riskAdded: "تمت إضافة المخاطرة إلى سجل المراجعة.",
  candidateLinked: "تم ربط مرشح المطالبة دون تقرير استحقاق تلقائي.",
  deadlineSaved: "تم حفظ الموعد كمؤشر مراجعة فقط.",
  handoffMissing: "اربط مرشح المطالبة بسلسلة Claim محفوظة أولاً قبل الانتقال إلى Notice أو التقرير.",
  handoffSelected: "تم اختيار سلسلة المطالبة. راجع المصدر والمستلم والتاريخ قبل حفظ أو إرسال أي Notice.",
};
const dateOnly = (value?: Date | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const shortDate = (value: Date | null | undefined, language: AppLanguage) => value ? new Date(value).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB") : language === "ar" ? "غير محدد" : "Not specified";

function SourceBadge({ status, language }: { status: SourceStatus; language: AppLanguage }) {
  const variant = status === "sourced" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant}>{sourceLabels[language][status]}</Badge>;
}

export function ClaimConsolePanel({ view, schedule, isAuthenticated, onNavigate, onActiveClaimChange }: { view: string; schedule: Schedule; isAuthenticated: boolean; onNavigate: (view: "notices" | "report") => void; onActiveClaimChange: (claimKey: string, narrative: string) => void }) {
  const { language, direction } = useAppLanguage();
  const toastText = claimConsoleToastText(language);
  const copy = language === "en" ? {
    accessTitle: "Contract profile and risk register",
    accessBody: "Sign in to save this register in the project workspace and share it through the review workflow. No sample data is added automatically.",
    heroTitle: "From risk, to issue, to a claim candidate",
    heroBody: "This is an organisation and review station. It does not infer contract clauses or FIDIC periods, and it does not decide entitlement or loss of rights. Review the source, start date, recipient and delivery method before any Notice or Claim.",
    openRisks: "Open risks", reviewDeadlines: "Deadlines needing review", contractProfile: "Contract profile", verified: "Verified", review: "Review",
    contractTitle: "Reference contract profile", contractBody: "Enter the reference exactly as recorded in the contract or special conditions. Empty fields are gaps, not assumed values.",
    riskTitle: "Risk register before an issue occurs", riskBody: "A risk is an observable signal; it becomes neither an issue nor a claim basis until verified and linked to the technical record.",
    candidateTitle: "Traceable claim candidate", candidateBody: "The link preserves a review trail between risk, issue and claim chain; it does not automatically make a claim due or a Notice ready to send.",
    deadlineTitle: "Deadline tracker requiring contract review", deadlineBody: "Use either a documented manual date or a reference date plus calendar days entered by the user. Passing a date does not mean loss of rights in this application.",
  } : {
    accessTitle: "ملف العقد وسجل المخاطر",
    accessBody: "سجّل الدخول لحفظ هذا السجل في مساحة المشروع ومشاركته في مسار المراجعة. لا يتم إدخال أي بيانات تجريبية تلقائياً.",
    heroTitle: "من المخاطرة إلى الواقعة ثم مرشح المطالبة",
    heroBody: "هذه محطة تنظيم ومراجعة. لا تستنتج التطبيق بنود العقد أو مدد FIDIC ولا تقرر استحقاقاً أو سقوط حق؛ راجع المصدر وتاريخ البدء والمستلم ووسيلة الإرسال قبل أي Notice أو Claim.",
    openRisks: "مخاطر مفتوحة", reviewDeadlines: "مواعيد تحتاج مراجعة", contractProfile: "ملف العقد", verified: "موثق", review: "راجع",
    contractTitle: "ملف العقد المرجعي للمشروع", contractBody: "اكتب المرجع كما هو من العقد أو الشروط الخاصة. الحقول الفارغة تظهر كفجوات وليست قيماً مفترضة.",
    riskTitle: "سجل المخاطر قبل تحولها إلى واقعة", riskBody: "المخاطرة مؤشر يمكن رصده؛ لا تصبح واقعة أو سبباً للمطالبة إلا بعد التحقق والربط بالسجل الفني.",
    candidateTitle: "مرشح مطالبة قابل للتتبع", candidateBody: "الربط هنا يثبت مسار المراجعة بين مخاطر وواقعة وسلسلة مطالبة؛ ولا يحولها تلقائياً إلى Claim مستحق أو Notice جاهز للإرسال.",
    deadlineTitle: "متابع موعد يحتاج مراجعة عقدية", deadlineBody: "إما تاريخ يدوي موثق أو تاريخ مرجعي + عدد أيام تقويمية أدخله المستخدم. «تجاوز الموعد» لا يساوي سقوط الحق في هذا البرنامج.",
  };
  const txt = (ar: string, en: string) => language === "en" ? en : ar;
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

  const saveContract = trpc.claimConsole.saveContractProfile.useMutation({ onSuccess: () => { invalidate(); toast.success(toastText.contractSaved); }, onError: error => toast.error(error.message) });
  const createRisk = trpc.claimConsole.createRisk.useMutation({ onSuccess: () => { invalidate(); setRisk(previous => ({ ...previous, title: "", description: "", sourceReference: "", reviewNotes: "", linkedPlannerIssueId: "none" })); toast.success(toastText.riskAdded); }, onError: error => toast.error(error.message) });
  const createCandidate = trpc.claimConsole.createCandidate.useMutation({ onSuccess: () => { invalidate(); setCandidate(previous => ({ ...previous, title: "", basisSummary: "", sourceReference: "", reviewNotes: "", riskId: "none", plannerIssueLogId: "none", claimChainId: "none" })); toast.success(toastText.candidateLinked); }, onError: error => toast.error(error.message) });
  const createDeadline = trpc.claimConsole.createDeadline.useMutation({ onSuccess: () => { invalidate(); setDeadline(previous => ({ ...previous, title: "", ruleDescription: "", sourceReference: "", reviewNotes: "", dueDate: "", calendarDays: "" })); toast.success(toastText.deadlineSaved); }, onError: error => toast.error(error.message) });

  if (view !== "claimConsole") return null;
  if (!isAuthenticated) return <section className="workflow-panel" dir={direction}><div className="workflow-heading"><div><p className="eyebrow">{txt("منصة المطالبات", "Claim Console")}</p><h2>{copy.accessTitle}</h2><p>{copy.accessBody}</p></div><ShieldAlert size={30} /></div></section>;

  const data = consoleData.data;
  const openRisks = data?.risks.filter(item => item.status !== "closed").length ?? 0;
  const reviewDeadlines = data?.deadlines.filter(item => item.status === "review_required" || item.sourceStatus !== "sourced").length ?? 0;
  const handoffToClaim = (claimChainId: number | null) => {
    const chain = data?.chains.find(item => item.id === claimChainId);
    if (!chain) {
      toast.error(toastText.handoffMissing);
      return;
    }
    onActiveClaimChange(chain.claimKey, "");
    onNavigate("notices");
    toast.message(toastText.handoffSelected);
  };

  return <div className="view-stack claim-console-view" dir={direction}>
    <section className="hero-panel border border-amber-200 bg-amber-50/70 text-slate-900">
      <div className="hero-copy">
        <p className="eyebrow">{txt("منصة المطالبات · نسخة أولية", "CLAIM CONSOLE · MVP")}</p>
        <h1>{copy.heroTitle}</h1>
        <p>{copy.heroBody}</p>
      </div>
      <div className="hero-side-grid">
        <div><small>{copy.openRisks}</small><strong>{openRisks}</strong></div>
        <div><small>{copy.reviewDeadlines}</small><strong>{reviewDeadlines}</strong></div>
        <div><small>{copy.contractProfile}</small><strong>{data?.profile?.sourceStatus === "sourced" ? copy.verified : copy.review}</strong></div>
      </div>
    </section>

    <section className="workflow-panel">
      <div className="workflow-heading"><div><p className="eyebrow">01 · {txt("ملف العقد", "Contract Profile")}</p><h2>{copy.contractTitle}</h2><p>{copy.contractBody}</p></div><FileCheck2 size={28} /></div>
      <div className="form-grid three-col">
        <div><Label htmlFor="cc-contract-title">{txt("اسم/عنوان العقد", "Contract name / title")}</Label><Input id="cc-contract-title" value={contract.contractTitle} onChange={event => setContract({ ...contract, contractTitle: event.target.value })} /></div>
        <div><Label htmlFor="cc-contract-form">{txt("نموذج العقد", "Contract form")}</Label><Input id="cc-contract-form" placeholder={txt("مثال: وفق النسخة الموقعة", "Example: as executed")} value={contract.contractForm} onChange={event => setContract({ ...contract, contractForm: event.target.value })} /></div>
        <div><Label htmlFor="cc-contract-edition">{txt("الإصدار أو النسخة", "Edition or version")}</Label><Input id="cc-contract-edition" value={contract.contractEdition} onChange={event => setContract({ ...contract, contractEdition: event.target.value })} /></div>
        <div><Label htmlFor="cc-special">{txt("مرجع الشروط الخاصة", "Particular conditions reference")}</Label><Input id="cc-special" value={contract.specialConditionsReference} onChange={event => setContract({ ...contract, specialConditionsReference: event.target.value })} /></div>
        <div><Label htmlFor="cc-law">{txt("القانون الحاكم", "Governing law")}</Label><Input id="cc-law" value={contract.governingLaw} onChange={event => setContract({ ...contract, governingLaw: event.target.value })} /></div>
        <div><Label htmlFor="cc-clause">{txt("مرجع بند المطالبة", "Claim clause reference")}</Label><Input id="cc-clause" value={contract.claimClauseReference} onChange={event => setContract({ ...contract, claimClauseReference: event.target.value })} /></div>
        <div><Label>{txt("حالة المصدر", "Source status")}</Label><Select value={contract.sourceStatus} onValueChange={value => setContract({ ...contract, sourceStatus: value as SourceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceLabels[language]).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="span-2"><Label htmlFor="cc-contract-source">{txt("مرجع المصدر أو موضعه", "Source reference or location")}</Label><Input id="cc-contract-source" placeholder={txt("رقم العقد / الملحق / صفحة أو رابط داخلي", "Contract number / appendix / page or internal link")} value={contract.sourceReference} onChange={event => setContract({ ...contract, sourceReference: event.target.value })} /></div>
      </div>
      <div className="form-grid two-col mt-4"><div><Label htmlFor="cc-trigger">{txt("وصف نقطة بدء الإخطار بحسب النص المراجع", "Notice trigger as described in the reviewed text")}</Label><Textarea id="cc-trigger" value={contract.noticeTriggerDescription} onChange={event => setContract({ ...contract, noticeTriggerDescription: event.target.value })} /></div><div><Label htmlFor="cc-contract-review">{txt("ملاحظات المراجعة والفجوات", "Review notes and gaps")}</Label><Textarea id="cc-contract-review" value={contract.reviewNotes} onChange={event => setContract({ ...contract, reviewNotes: event.target.value })} /></div></div>
      <Button className="mt-4" onClick={() => saveContract.mutate({ projectKey: schedule.id, ...contract })} disabled={saveContract.isPending}>{saveContract.isPending ? txt("جارٍ الحفظ...", "Saving…") : txt("حفظ ملف العقد", "Save contract profile")}</Button>
    </section>

    <section className="workflow-panel">
      <div className="workflow-heading"><div><p className="eyebrow">02 · Risk Register</p><h2>{copy.riskTitle}</h2><p>{copy.riskBody}</p></div><FlagTriangleRight size={28} /></div>
      <div className="form-grid three-col">
        <div><Label htmlFor="cc-risk-key">{txt("مفتاح المخاطرة", "Risk key")}</Label><Input id="cc-risk-key" value={risk.riskKey} onChange={event => setRisk({ ...risk, riskKey: event.target.value })} /></div>
        <div className="span-2"><Label htmlFor="cc-risk-title">{txt("عنوان المخاطرة", "Risk title")}</Label><Input id="cc-risk-title" value={risk.title} onChange={event => setRisk({ ...risk, title: event.target.value })} /></div>
        <div><Label htmlFor="cc-risk-date">{txt("تاريخ الرصد", "Identified date")}</Label><Input id="cc-risk-date" type="date" value={risk.identifiedDate} onChange={event => setRisk({ ...risk, identifiedDate: event.target.value })} /></div>
        <div><Label htmlFor="cc-risk-owner">{txt("مالك المتابعة / الدور", "Owner / role")}</Label><Input id="cc-risk-owner" value={risk.ownerRole} onChange={event => setRisk({ ...risk, ownerRole: event.target.value })} /></div>
        <div><Label>{txt("ربط بواقعة فنية (اختياري)", "Linked technical issue (optional)")}</Label><Select value={risk.linkedPlannerIssueId} onValueChange={value => setRisk({ ...risk, linkedPlannerIssueId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{txt("لا يوجد بعد", "Not linked yet")}</SelectItem>{data?.issues.map(issue => <SelectItem key={issue.id} value={String(issue.id)}>{issue.issueNo} — {issue.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>{txt("حالة المصدر", "Source status")}</Label><Select value={risk.sourceStatus} onValueChange={value => setRisk({ ...risk, sourceStatus: value as SourceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceLabels[language]).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>{txt("حالة المتابعة", "Tracking status")}</Label><Select value={risk.status} onValueChange={value => setRisk({ ...risk, status: value as typeof risk.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">{txt("مفتوحة", "Open")}</SelectItem><SelectItem value="monitoring">{txt("تحت المراقبة", "Monitoring")}</SelectItem><SelectItem value="escalated">{txt("صعّدت للمراجعة", "Escalated for review")}</SelectItem><SelectItem value="closed">{txt("مغلقة", "Closed")}</SelectItem></SelectContent></Select></div>
        <div><Label htmlFor="cc-risk-source">{txt("مرجع المصدر", "Source reference")}</Label><Input id="cc-risk-source" value={risk.sourceReference} onChange={event => setRisk({ ...risk, sourceReference: event.target.value })} /></div>
      </div>
      <div className="form-grid two-col mt-4"><div><Label htmlFor="cc-risk-desc">{txt("الوصف", "Description")}</Label><Textarea id="cc-risk-desc" value={risk.description} onChange={event => setRisk({ ...risk, description: event.target.value })} /></div><div><Label htmlFor="cc-risk-review">{txt("ملاحظات مراجعة", "Review notes")}</Label><Textarea id="cc-risk-review" value={risk.reviewNotes} onChange={event => setRisk({ ...risk, reviewNotes: event.target.value })} /></div></div>
      <Button className="mt-4" onClick={() => createRisk.mutate({ projectKey: schedule.id, ...risk, linkedPlannerIssueId: risk.linkedPlannerIssueId === "none" ? null : Number(risk.linkedPlannerIssueId) })} disabled={createRisk.isPending}><Plus size={16} />{txt("إضافة مخاطرة", "Add risk")}</Button>
      <div className="data-table-wrap mt-5"><table><thead><tr><th>{txt("المفتاح", "Key")}</th><th>{txt("المخاطرة", "Risk")}</th><th>{txt("الواقعة المرتبطة", "Linked issue")}</th><th>{txt("المصدر", "Source")}</th><th>{txt("الحالة", "Status")}</th></tr></thead><tbody>{data?.risks.length ? data.risks.map(item => <tr key={item.id}><td>{item.riskKey}</td><td><b>{item.title}</b><small>{item.description}</small></td><td>{item.linkedPlannerIssueId ? `Issue #${item.linkedPlannerIssueId}` : txt("لم تربط بعد", "Not linked yet")}</td><td><SourceBadge status={item.sourceStatus} language={language} /></td><td>{item.status}</td></tr>) : <tr><td colSpan={5}>{txt("لا توجد مخاطر محفوظة للمشروع حتى الآن.", "No risks have been saved for this project yet.")}</td></tr>}</tbody></table></div>
    </section>

    <section className="workflow-panel">
      <div className="workflow-heading"><div><p className="eyebrow">{txt("03 · واقعة ← مرشح مطالبة", "03 · Issue → Claim Candidate")}</p><h2>{copy.candidateTitle}</h2><p>{copy.candidateBody}</p></div><Link2 size={28} /></div>
      <div className="form-grid three-col">
        <div><Label htmlFor="cc-candidate-key">{txt("مفتاح المرشح", "Candidate key")}</Label><Input id="cc-candidate-key" value={candidate.candidateKey} onChange={event => setCandidate({ ...candidate, candidateKey: event.target.value })} /></div>
        <div className="span-2"><Label htmlFor="cc-candidate-title">{txt("عنوان مرشح المطالبة", "Claim candidate title")}</Label><Input id="cc-candidate-title" value={candidate.title} onChange={event => setCandidate({ ...candidate, title: event.target.value })} /></div>
        <div><Label>{txt("المخاطرة", "Risk")}</Label><Select value={candidate.riskId} onValueChange={value => setCandidate({ ...candidate, riskId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{txt("غير مرتبطة", "Not linked")}</SelectItem>{data?.risks.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.riskKey} — {item.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>{txt("الواقعة الفنية", "Technical issue")}</Label><Select value={candidate.plannerIssueLogId} onValueChange={value => setCandidate({ ...candidate, plannerIssueLogId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{txt("غير مرتبطة", "Not linked")}</SelectItem>{data?.issues.map(issue => <SelectItem key={issue.id} value={String(issue.id)}>{issue.issueNo} — {issue.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>{txt("سلسلة المطالبة", "Claim chain")}</Label><Select value={candidate.claimChainId} onValueChange={value => setCandidate({ ...candidate, claimChainId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{txt("غير مرتبطة", "Not linked")}</SelectItem>{data?.chains.map(chain => <SelectItem key={chain.id} value={String(chain.id)}>{chain.claimKey} — {chain.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="cc-candidate-clause">{txt("مرجع البند", "Clause reference")}</Label><Input id="cc-candidate-clause" value={candidate.contractClauseReference} onChange={event => setCandidate({ ...candidate, contractClauseReference: event.target.value })} /></div>
        <div><Label>{txt("حالة المصدر", "Source status")}</Label><Select value={candidate.sourceStatus} onValueChange={value => setCandidate({ ...candidate, sourceStatus: value as SourceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceLabels[language]).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>{txt("حالة المرشح", "Candidate status")}</Label><Select value={candidate.status} onValueChange={value => setCandidate({ ...candidate, status: value as typeof candidate.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">{txt("مسودة", "Draft")}</SelectItem><SelectItem value="under_review">{txt("تحت المراجعة", "Under review")}</SelectItem><SelectItem value="ready_for_notice">{txt("جاهز لمراجعة Notice", "Ready for Notice review")}</SelectItem><SelectItem value="linked_to_claim">{txt("مرتبط بسلسلة Claim", "Linked to claim chain")}</SelectItem><SelectItem value="closed">{txt("مغلق", "Closed")}</SelectItem></SelectContent></Select></div>
      </div>
      <div className="form-grid two-col mt-4"><div><Label htmlFor="cc-candidate-basis">{txt("ملخص الأساس والفجوات", "Basis summary and gaps")}</Label><Textarea id="cc-candidate-basis" value={candidate.basisSummary} onChange={event => setCandidate({ ...candidate, basisSummary: event.target.value })} /></div><div><Label htmlFor="cc-candidate-review">{txt("ملاحظات المراجع", "Reviewer notes")}</Label><Textarea id="cc-candidate-review" value={candidate.reviewNotes} onChange={event => setCandidate({ ...candidate, reviewNotes: event.target.value })} /></div></div>
      <div className="mt-3"><Label htmlFor="cc-candidate-source">{txt("مرجع المصدر", "Source reference")}</Label><Input id="cc-candidate-source" value={candidate.sourceReference} onChange={event => setCandidate({ ...candidate, sourceReference: event.target.value })} /></div>
      <Button className="mt-4" onClick={() => createCandidate.mutate({ projectKey: schedule.id, ...candidate, riskId: candidate.riskId === "none" ? null : Number(candidate.riskId), plannerIssueLogId: candidate.plannerIssueLogId === "none" ? null : Number(candidate.plannerIssueLogId), claimChainId: candidate.claimChainId === "none" ? null : Number(candidate.claimChainId) })} disabled={createCandidate.isPending}><Plus size={16} />{txt("إضافة مرشح المطالبة", "Add claim candidate")}</Button>
      <div className="data-table-wrap mt-5"><table><thead><tr><th>{txt("المفتاح", "Key")}</th><th>{txt("المرشح", "Candidate")}</th><th>{txt("الربط", "Links")}</th><th>{txt("المصدر", "Source")}</th><th>{txt("الحالة", "Status")}</th><th>{txt("تسليم للمراجعة", "Review handoff")}</th></tr></thead><tbody>{data?.candidates.length ? data.candidates.map(item => <tr key={item.id}><td>{item.candidateKey}</td><td><b>{item.title}</b><small>{item.basisSummary}</small></td><td>{[item.riskId && `Risk #${item.riskId}`, item.plannerIssueLogId && `Issue #${item.plannerIssueLogId}`, item.claimChainId && `Claim #${item.claimChainId}`].filter(Boolean).join(" · ")}</td><td><SourceBadge status={item.sourceStatus} language={language} /></td><td>{item.status}</td><td><Button variant="outline" size="sm" onClick={() => handoffToClaim(item.claimChainId)} disabled={!item.claimChainId}>{txt("فتح Notice", "Open Notice")}</Button></td></tr>) : <tr><td colSpan={6}>{txt("أضف ربطاً واحداً على الأقل قبل إنشاء مرشح مطالبة.", "Add at least one link before creating a claim candidate.")}</td></tr>}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 mt-4"><p className="m-0 text-sm text-slate-700">{txt("استخدم فتح Notice بعد ربط سلسلة Claim، ثم ارجع إلى تقرير المطالبة لتصدير Fact Pack أو Full Claim V1 من البيانات التي راجعتها.", "Use Open Notice after linking a claim chain, then return to the claim report to export a Fact Pack or Full Claim V1 from reviewed data.")}</p><Button variant="outline" size="sm" onClick={() => onNavigate("report")}>{txt("فتح Fact Pack / Full Claim", "Open Fact Pack / Full Claim")}</Button></div>
    </section>

    <section className="workflow-panel">
      <div className="workflow-heading"><div><p className="eyebrow">{txt("04 · متابع المواعيد القابل للضبط", "04 · Configurable Deadline Tracker")}</p><h2>{copy.deadlineTitle}</h2><p>{copy.deadlineBody}</p></div><BellRing size={28} /></div>
      <div className="alert-strip warning"><AlertTriangle size={18} />{txt("لا يوجد 28 أو 42 أو 84 يوماً ثابتاً هنا. راجع نص العقد والشروط الخاصة وتاريخ العلم ووسيلة الإرسال قبل إنشاء Notice.", "There is no fixed 28-, 42-, or 84-day period here. Review the contract, particular conditions, knowledge date and delivery method before creating a Notice.")}</div>
      <div className="form-grid three-col mt-4">
        <div><Label>{txt("مرشح المطالبة", "Claim candidate")}</Label><Select value={deadline.claimCandidateId} onValueChange={value => setDeadline({ ...deadline, claimCandidateId: value })}><SelectTrigger><SelectValue placeholder={txt("اختَر المرشح", "Select candidate")} /></SelectTrigger><SelectContent><SelectItem value="none">{txt("اختَر مرشحاً محفوظاً", "Select a saved candidate")}</SelectItem>{data?.candidates.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.candidateKey} — {item.title}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="cc-deadline-key">{txt("مفتاح الموعد", "Deadline key")}</Label><Input id="cc-deadline-key" value={deadline.deadlineKey} onChange={event => setDeadline({ ...deadline, deadlineKey: event.target.value })} /></div>
        <div><Label htmlFor="cc-deadline-title">{txt("عنوان الموعد", "Deadline title")}</Label><Input id="cc-deadline-title" value={deadline.title} onChange={event => setDeadline({ ...deadline, title: event.target.value })} /></div>
        <div><Label>{txt("نوع الموعد", "Deadline type")}</Label><Select value={deadline.deadlineKind} onValueChange={value => setDeadline({ ...deadline, deadlineKind: value as typeof deadline.deadlineKind })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="notice">{txt("إشعار", "Notice")}</SelectItem><SelectItem value="particulars">{txt("تفاصيل مطالبة", "Particulars")}</SelectItem><SelectItem value="substantiation">{txt("تدعيم بالمستندات", "Substantiation")}</SelectItem><SelectItem value="other">{txt("آخر", "Other")}</SelectItem></SelectContent></Select></div>
        <div><Label>{txt("طريقة الإدخال", "Entry method")}</Label><Select value={deadline.calculationMode} onValueChange={value => setDeadline({ ...deadline, calculationMode: value as typeof deadline.calculationMode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual_date">{txt("تاريخ يدوي موثق", "Documented manual date")}</SelectItem><SelectItem value="calendar_days">{txt("تاريخ مرجعي + أيام تقويمية", "Reference date + calendar days")}</SelectItem></SelectContent></Select></div>
        <div><Label>{txt("حالة المتابعة", "Tracking status")}</Label><Select value={deadline.status} onValueChange={value => setDeadline({ ...deadline, status: value as typeof deadline.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unconfigured">{txt("غير مهيأ", "Unconfigured")}</SelectItem><SelectItem value="tracking">{txt("قيد المتابعة", "Tracking")}</SelectItem><SelectItem value="review_required">{txt("مراجعة مطلوبة", "Review required")}</SelectItem><SelectItem value="completed">{txt("مكتمل", "Completed")}</SelectItem><SelectItem value="superseded">{txt("استبدل", "Superseded")}</SelectItem></SelectContent></Select></div>
        {deadline.calculationMode === "manual_date" ? <div><Label htmlFor="cc-due-date">{txt("التاريخ النهائي اليدوي", "Manual due date")}</Label><Input id="cc-due-date" type="date" value={deadline.dueDate} onChange={event => setDeadline({ ...deadline, dueDate: event.target.value })} /></div> : <><div><Label htmlFor="cc-reference-date">{txt("التاريخ المرجعي", "Reference date")}</Label><Input id="cc-reference-date" type="date" value={deadline.referenceDate} onChange={event => setDeadline({ ...deadline, referenceDate: event.target.value })} /></div><div><Label htmlFor="cc-calendar-days">{txt("عدد الأيام التقويمية", "Calendar-day count")}</Label><Input id="cc-calendar-days" type="number" min="0" value={deadline.calendarDays} onChange={event => setDeadline({ ...deadline, calendarDays: event.target.value })} /></div></>}
        <div><Label>{txt("حالة المصدر", "Source status")}</Label><Select value={deadline.sourceStatus} onValueChange={value => setDeadline({ ...deadline, sourceStatus: value as SourceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(sourceLabels[language]).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="form-grid two-col mt-4"><div><Label htmlFor="cc-deadline-rule">{txt("القاعدة/السبب كما هو موثق", "Rule / reason as documented")}</Label><Textarea id="cc-deadline-rule" value={deadline.ruleDescription} onChange={event => setDeadline({ ...deadline, ruleDescription: event.target.value })} /></div><div><Label htmlFor="cc-deadline-review">{txt("ملاحظات مراجعة", "Review notes")}</Label><Textarea id="cc-deadline-review" value={deadline.reviewNotes} onChange={event => setDeadline({ ...deadline, reviewNotes: event.target.value })} /></div></div>
      <div className="mt-3"><Label htmlFor="cc-deadline-source">{txt("مرجع المصدر", "Source reference")}</Label><Input id="cc-deadline-source" value={deadline.sourceReference} onChange={event => setDeadline({ ...deadline, sourceReference: event.target.value })} /></div>
      <Button className="mt-4" onClick={() => { if (deadline.claimCandidateId === "none") return toast.error(txt("اختَر مرشح مطالبة أولاً.", "Select a claim candidate first.")); createDeadline.mutate({ projectKey: schedule.id, ...deadline, claimCandidateId: Number(deadline.claimCandidateId), calendarDays: deadline.calendarDays ? Number(deadline.calendarDays) : null, dueDate: deadline.dueDate || null, referenceDate: deadline.referenceDate || null }); }} disabled={createDeadline.isPending}><Plus size={16} />{txt("حفظ مؤشر الموعد", "Save deadline tracker")}</Button>
      <div className="data-table-wrap mt-5"><table><thead><tr><th>{txt("الموعد", "Deadline")}</th><th>{txt("المرشح", "Candidate")}</th><th>{txt("التاريخ", "Date")}</th><th>{txt("المصدر", "Source")}</th><th>{txt("الحالة", "Status")}</th></tr></thead><tbody>{data?.deadlines.length ? data.deadlines.map(item => <tr key={item.id}><td><b>{item.title}</b><small>{item.deadlineKey} · {item.deadlineKind}</small></td><td>{data.candidates.find(candidateItem => candidateItem.id === item.claimCandidateId)?.candidateKey ?? `#${item.claimCandidateId}`}</td><td>{shortDate(item.dueDate, language)}<small>{item.calculationMode === "calendar_days" && item.referenceDate ? `${dateOnly(item.referenceDate)} + ${item.calendarDays} ${language === "ar" ? "يوم" : "calendar days"}` : language === "ar" ? "تاريخ يدوي" : "Manual date"}</small></td><td><SourceBadge status={item.sourceStatus} language={language} /></td><td>{item.status}</td></tr>) : <tr><td colSpan={5}>{txt("لا توجد مؤشرات مواعيد. لا تضف موعداً قبل توثيق قاعدته ومصدره.", "No deadline trackers. Do not add one before documenting its rule and source.")}</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
