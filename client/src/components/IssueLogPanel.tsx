import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Download, FileCog, FileUp, LogIn, Plus, ShieldCheck, Table2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { bilingualUiLabel } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import type { Fragnet, Relationship, Schedule } from "@/lib/cpm";
import { issueProposalToFragnet, type IssueFragnetProposal } from "@/lib/issue-fragnet";
import { downloadIssueImportTemplate, exportIssueRegisterExcel, parseIssueRegisterExcel, type ExcelIssueRow } from "@/lib/issue-excel";
import "./issue-log.css";

type View = "guided" | "overview" | "schedule" | "quality" | "event" | "windows" | "methods" | "analysis" | "report" | "financial" | "notices" | "review" | "members" | "compare" | "resources" | "learning" | "issues";

function interfaceCopy(language: "ar" | "en") {
  const en = language === "en";
  return {
    plannerIssueLog: "PLANNER ISSUE LOG",
    loginHeading: en ? "Schedule-impacting issue log" : "سجل القضايا المؤثر في البرنامج",
    loginDescription: en ? "Record the fact first, then review the proposed Fragnet before adding it to an independent TIA copy." : "سجّل الواقعة أولاً ثم راجع Fragnet المقترح قبل إضافته إلى نسخة TIA مستقلة.",
    loginPrompt: en ? "Sign in to save project issues and the Fragnet review trail securely." : "سجّل الدخول لحفظ قضايا المشروع وسجل مراجعة Fragnet بشكل آمن.",
    login: en ? "Sign in" : "تسجيل الدخول",
    saveSuccess: en ? "The issue and proposed Fragnet were saved for review." : "تم حفظ القضية ومقترح الـ Fragnet للمراجعة.",
    preparedSuccess: en ? "The proposal is ready for technical review before insertion." : "تم تجهيز المقترح للمراجعة الفنية قبل إدراجه.",
    missingRelationship: en ? "The reference relationship is no longer in this schedule copy; the proposal was not applied." : "لم تعد العلاقة المرجعية موجودة في النسخة الحالية من البرنامج؛ لم يطبق المقترح.",
    alreadyApplied: en ? "This Fragnet already exists in the local TIA copy." : "هذا الـ Fragnet موجود بالفعل في نسخة TIA المحلية.",
    appliedSuccess: en ? "The issue insertion was recorded in the independent TIA copy. Review the impact calculation before relying on a claim." : "تم تسجيل إدراج القضية في نسخة TIA المستقلة. راجع حساب الأثر قبل اعتماد المطالبة.",
    statusSuccess: en ? "The issue status was updated and the review trail was retained." : "تم تحديث حالة القضية مع حفظ أثر المراجعة.",
    importSuccess: (count: number) => en ? `${count} issue / relationship record(s) were saved after validation. No Fragnet was applied automatically.` : `تم حفظ ${count} قضية/نقطة ربط بعد التحقق. لم يُطبق أي Fragnet تلقائياً.`,
    pasteIdsFirst: en ? "Paste Activity IDs separated by a comma or a new line first." : "الصق Activity IDs مفصولة بفاصلة أو سطر جديد أولاً.",
    noKnownIds: en ? "None of the entered IDs exists in the current schedule." : "ولا معرف من المكتوب موجود في البرنامج الحالي.",
    maxActivities: en ? "A maximum of 100 affected activities is allowed per issue. Review or split the issue scope." : "الحد الأقصى 100 نشاط متأثر لكل واقعة. راجع نطاق الواقعة أو قسّمها.",
    addedWithMissing: (accepted: number, unknown: string, suffix: string) => en ? `${accepted} activity(ies) added; not found: ${unknown}${suffix}.` : `تمت إضافة ${accepted} نشاط؛ لم أجد: ${unknown}${suffix}.`,
    addedActivities: (count: number) => en ? `${count} activity(ies) added to the issue scope.` : `تمت إضافة ${count} نشاط إلى نطاق الواقعة.`,
    requirementIssueNo: en ? "Issue number" : "رقم واقعة",
    requirementTitle: en ? "Clear title" : "عنوان واضح",
    requirementDate: en ? "Occurrence date" : "تاريخ الواقعة",
    requirementDuration: en ? "Proposed duration greater than zero" : "مدة مقترحة أكبر من صفر",
    requirementRelationship: en ? "At least one relationship point" : "نقطة ربط واحدة على الأقل",
    requirementActivity: en ? "At least one affected activity" : "نشاط متأثر واحد على الأقل",
    requirementDescription: en ? "Technical description (at least 10 characters)" : "وصف فني (10 أحرف على الأقل)",
    requirementImpact: en ? "Impact summary (at least 5 characters)" : "ملخص أثر (5 أحرف على الأقل)",
    requirementEvidence: en ? "Reference or evidence (at least 3 characters)" : "مرجع أو دليل (3 أحرف على الأقل)",
    fileTypeError: en ? "Choose an XLSX or XLS Excel file only." : "اختر ملف Excel بصيغة XLSX أو XLS فقط.",
    importFailed: (count: number) => en ? `The file cannot be imported: ${count} error(s) need correction.` : `لا يمكن استيراد الملف: ${count} خطأ يحتاج تصحيحاً.`,
    importPreview: (count: number) => en ? `${count} issue(s) were previewed. Review them, then confirm saving.` : `تمت معاينة ${count} قضية. راجعها ثم أكد الحفظ.`,
    fileReadError: en ? "Excel could not be read. Check that the file is not protected and uses the approved template." : "تعذر قراءة ملف Excel. تحقق من أن الملف غير محمي ومن استخدام القالب المعتمد.",
    heading: en ? "Schedule-impacting issue register" : "سجل الواقعة المؤثرة في البرنامج",
    headingDescription: en ? "Record what happened first. Then choose the actual relationship point(s) from the imported schedule and review the Fragnet proposal before adding it to an independent TIA copy." : "سجّل ما حدث أولاً. بعدها اختَر نقطة أو نقاط الربط الفعلية من البرنامج المستورد، وراجع مقترح Fragnet قبل إضافته إلى نسخة TIA مستقلة.",
    caution: en ? "The result is a reviewable technical proposal, not an entitlement finding or a direct P6 schedule change." : "النتيجة مقترح فني قابل للمراجعة وليست تقرير استحقاق أو تعديل مباشر لبرنامج P6.",
    excelExchange: en ? "Controlled Excel exchange" : "تبادل Excel مضبوط",
    excelHelp: en ? "Download the template first. The app validates rows, columns, activity IDs, and relationships before any issue is saved." : "حمّل القالب أولاً. يتحقق التطبيق من الصفوف والأعمدة ومعرفات الأنشطة والعلاقات قبل حفظ أي قضية.",
    excelTemplate: en ? "Excel template" : "قالب Excel",
    exportRegister: en ? "Export register" : "تصدير السجل",
    importExcel: en ? "Import Excel" : "استيراد Excel",
    importErrors: en ? "Import errors — no row was saved" : "أخطاء الاستيراد — لم يُحفظ أي صف",
    extraErrors: (count: number) => en ? `${count} additional error(s).` : `و${count} أخطاء إضافية.`,
    validPreview: (count: number) => en ? `Valid preview: ${count} issue(s)` : `معاينة صالحة: ${count} قضية`,
    confirmBatch: en ? "Confirm batch import" : "تأكيد استيراد الدفعة",
    beforeSave: en ? "Before saving: what is missing?" : "قبل الحفظ: ما الذي ينقصني؟",
    beforeSaveHelp: en ? "The save button activates only when required items are complete. There are no hidden conditions." : "لن يتفعّل زر الحفظ إلا بعد استكمال العناصر المطلوبة. لا توجد شروط مخفية.",
    issueNumber: en ? "Issue number" : "رقم القضية",
    issueTitle: en ? "Issue title" : "عنوان القضية",
    occurrenceDate: en ? "Occurrence date" : "تاريخ الواقعة",
    reportedBy: en ? "Reported by" : "أبلغ عنها",
    reportedByPlaceholder: en ? "Planner name / organisation" : "اسم البلانر / الجهة",
    responsibility: en ? "Apparent responsibility (from records)" : "المسؤولية الظاهرة (من المستندات)",
    responsibilityHelp: en ? "Who appears initially responsible from correspondence or minutes; it is not a final finding." : "من يبدو مسؤولاً مبدئياً من الخطابات أو المحاضر؛ ليس حكماً نهائياً.",
    cause: en ? "Analysis cause (provisional)" : "السبب المستخدم في التحليل (سبب مبدئي)",
    causeHelp: en ? "This classifies the event for calculation and narrative; it does not establish entitlement on its own." : "يحدد تصنيف الحدث للحساب والسرد، ولا يثبت الاستحقاق وحده.",
    criticality: en ? "Criticality classification" : "تصنيف الحرجية",
    duration: en ? "Proposed Fragnet duration (working days)" : "مدة Fragnet المقترحة (أيام عمل)",
    relationshipPoint: en ? "Relationship point where the Fragnet will be inserted" : "نقطة الربط التي سيدخل فيها Fragnet",
    selected: (count: number) => en ? `${count} selected` : `${count} مختارة`,
    relationshipHelp: en ? "This is the arrow relationship between a preceding and a succeeding activity. It comes from your imported schedule, not a fixed list. If more than one point is selected, the system saves an independent issue and Fragnet proposal for each point so the paths do not get mixed." : "هذه هي علاقة السهم بين نشاط سابق ونشاط لاحق. تظهر من البرنامج الذي رفعته أنت، وليست قائمة ثابتة. إذا اخترت أكثر من نقطة، يحفظ النظام قضية ومقترح Fragnet مستقلين لكل نقطة حتى لا يختلط المسار.",
    relationshipSearch: en ? "Search by relationship ID, Activity ID, or activity name…" : "ابحث برقم العلاقة أو Activity ID أو اسم النشاط…",
    unreadActivity: en ? "Unread activity" : "نشاط غير مقروء",
    noRelationship: en ? "No relationship matches the search. Review the imported P6 schedule or clear the search." : "لا توجد علاقة مطابقة للبحث. راجع برنامج P6 المستورد أو امسح البحث.",
    affectedActivities: en ? "Affected activities (for evidence and review)" : "الأنشطة المتأثرة (للتوثيق والمراجعة)",
    activityHelp: en ? "Selecting activities shows the issue scope to the reviewer. The Fragnet insertion position is set by the relationship point above. Search by Activity ID, name, or WBS, or paste IDs from Excel; each selected relationship remains an independent Fragnet proposal." : "اختيار الأنشطة يوضح نطاق الواقعة للمراجع. أما موضع إدراج الـFragnet فيحدده اختيار «نقطة الربط» أعلاه. ابحث بالـActivity ID أو الاسم أو WBS، أو الصق قائمة IDs من Excel؛ كل علاقة مختارة تبقى مقترح Fragnet مستقل.",
    activitySearch: en ? "Search by Activity ID, name, or WBS…" : "ابحث بالـActivity ID أو الاسم أو WBS…",
    pasteIds: en ? "Paste Activity IDs: A100, A110, or one ID per line" : "الصق Activity IDs: A100، A110 أو كل ID في سطر",
    addIds: en ? "Add IDs" : "إضافة المعرفات",
    noActivities: en ? "No activities match the search. Clear the search or review IDs in the imported schedule." : "لا توجد أنشطة مطابقة للبحث. امسح البحث أو راجع المعرفات في البرنامج المستورد.",
    technicalDescription: en ? "Technical description" : "الوصف الفني",
    technicalDescriptionPlaceholder: en ? "Explain the technical facts and why the selected relationship or activities are suitable for analysis…" : "اشرح الوقائع الفنية وما الذي يجعل العلاقة أو الأنشطة المختارة مناسبة للتحليل…",
    impactSummary: en ? "Expected impact summary" : "ملخص الأثر المتوقع",
    impactPlaceholder: en ? "Explain the expected impact on sequence, duration, or criticality. This does not replace a TIA calculation." : "اشرح الأثر المتوقع على التسلسل أو المدة أو الحرجية. لا يغني ذلك عن حساب TIA.",
    evidence: en ? "References and evidence" : "المراجع والأدلة",
    evidencePlaceholder: en ? "State the letter, minutes, photograph, contract clause, or evidence link…" : "اذكر رقم الخطاب أو المحضر أو الصورة أو بند العقد أو رابط الدليل…",
    multipleSaveNotice: (count: number) => en ? `${count} independent issues will be saved, one per relationship point, then each Fragnet is reviewed separately.` : `سيتم حفظ ${count} قضايا مستقلة، واحدة لكل نقطة ربط، ثم تراجع كل Fragnet على حدة.`,
    oneSaveNotice: en ? "Review the relationship point and duration before saving; change the impact after application through a new corrective issue to retain the audit trail." : "راجع نقطة الربط والمدة قبل الحفظ؛ تعديل الأثر بعد التطبيق يكون بقضية تصحيحية جديدة لحفظ التدقيق.",
    missingSaveNotice: (items: string) => en ? `Complete the following to enable saving: ${items}` : `أكمل الآتي لتفعيل الحفظ: ${items}`,
    saveSeparate: (count: number) => en ? `Save ${count} separate proposals` : `حفظ ${count} مقترحات منفصلة`,
    saveIssue: en ? "Save issue and Fragnet proposal" : "حفظ القضية ومقترح Fragnet",
    proposalReady: en ? "Proposal ready for review:" : "مقترح جاهز للمراجعة:",
    affectedLabel: en ? "Affected activities:" : "الأنشطة المتأثرة:",
    responsibilityLabel: en ? "Responsibility:" : "المسؤولية:",
    causeLabel: en ? "Cause:" : "السبب:",
    prepareAgain: en ? "Prepare the issue again from the register row before applying." : "أعد تجهيز القضية من صف السجل قبل التطبيق.",
    approveInsert: en ? "Approve and insert in TIA" : "اعتماد وإدراج في TIA",
    register: en ? "Saved issue register" : "سجل القضايا المحفوظ",
    issueCount: (count: number) => en ? `${count} issue(s)` : `${count} قضية`,
    loading: en ? "Loading register…" : "جار تحميل السجل…",
    impactLabel: en ? "Impact summary:" : "ملخص الأثر:",
    referencesLabel: en ? "References:" : "المراجع:",
    dayRelationship: (days: string, relationshipId: string) => en ? `${days} day(s) · Relationship ${relationshipId}` : `${days} يوم · علاقة ${relationshipId}`,
    relationshipTitleSuffix: (relationshipId: string) => en ? `— relationship point ${relationshipId}` : `— نقطة ربط ${relationshipId}`,
    prepare: en ? "Prepare Fragnet" : "تجهيز Fragnet",
    reject: en ? "Reject" : "رفض",
    reviewThenApprove: en ? "Review the proposal card, then choose Approve and insert in TIA." : "راجع بطاقة المقترح ثم اضغط اعتماد وإدراج في TIA.",
    approveApply: en ? "Approve and apply" : "اعتماد وتطبيق",
    showProposal: en ? "Show proposal" : "عرض المقترح",
    close: en ? "Close" : "إغلاق",
    noIssues: en ? "No issues yet. Start by recording an event from site minutes or a site register, then review the proposed Fragnet." : "لا توجد قضايا بعد. ابدأ بتسجيل واقعة من محضر أو سجل موقع ثم راجع Fragnet المقترح.",
    responsibilityValues: (en ? { employer: "Employer", contractor: "Contractor", engineer: "Engineer", third_party: "Third party", undetermined: "Undetermined" } : { employer: "صاحب العمل", contractor: "المقاول", engineer: "المهندس", third_party: "طرف ثالث", undetermined: "غير محددة" }) satisfies Record<string, string>,
    causeValues: (en ? { employer: "Employer", contractor: "Contractor", neutral: "Neutral / under review" } : { employer: "صاحب العمل", contractor: "المقاول", neutral: "محايد / قيد التحقق" }) satisfies Record<string, string>,
    criticalityValues: (en ? { unknown: "Under assessment", potentially_critical: "Potentially critical", critical: "Critical", noncritical: "Non-critical" } : { unknown: "قيد التقييم", potentially_critical: "مرشح للحرجية", critical: "حرج", noncritical: "غير حرج" }) satisfies Record<string, string>,
    statusValues: (en ? { open: "Open", ready_for_fragnet: "Ready for review", applied: "Applied in TIA", rejected: "Rejected", closed: "Closed" } : { open: "مفتوحة", ready_for_fragnet: "جاهزة للمراجعة", applied: "طُبقت في TIA", rejected: "مرفوضة", closed: "مغلقة" }) satisfies Record<string, string>,
    undetermined: en ? "Not yet determined" : "غير محددة بعد",
    neutral: en ? "Under review / neutral" : "قيد التحقق / محايد",
    employerCause: en ? "Employer-side" : "من جهة صاحب العمل",
    contractorCause: en ? "Contractor-side" : "من جهة المقاول",
  };
}

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
  const { language, direction } = useAppLanguage();
  const copy = interfaceCopy(language);
  const bi = (arabic: string, english: string) => bilingualUiLabel(language, arabic, english);
  const responsibilityLabel = copy.responsibilityValues;
  const causeLabel = copy.causeValues;
  const criticalityLabel = copy.criticalityValues;
  const statusLabel = copy.statusValues;
  const utils = trpc.useUtils();
  const projectInput = useMemo(() => ({ projectKey: schedule.id }), [schedule.id]);
  const issues = trpc.issueLog.list.useQuery(projectInput, { enabled: isAuthenticated && view === "issues" });
  const create = trpc.issueLog.create.useMutation({ onSuccess: () => { utils.issueLog.list.invalidate(projectInput); setTitle(""); setDescription(""); setImpactSummary(""); setReferenceNotes(""); setIssueNo(""); setRelationshipIds([]); toast.success(copy.saveSuccess); }, onError: error => toast.error(error.message) });
  const prepare = trpc.issueLog.prepareFragnet.useMutation({ onSuccess: raw => { const proposal = parseProposal(raw); setPreview(proposal); utils.issueLog.list.invalidate(projectInput); toast.success(copy.preparedSuccess); }, onError: error => toast.error(error.message) });
  const recordApplied = trpc.issueLog.recordApplied.useMutation({ onSuccess: raw => { const proposal = parseProposal(raw); const relationship = proposal ? schedule.relationships.find(item => item.id === proposal.relationshipId) : undefined; if (!proposal || !relationship) { toast.error(copy.missingRelationship); return; }
    if (existingEvents.some(event => event.id === proposal.id)) { toast.error(copy.alreadyApplied); return; }
    onApplyFragnet(issueProposalToFragnet(proposal, relationship)); setPreview(null); utils.issueLog.list.invalidate(projectInput); toast.success(copy.appliedSuccess); }, onError: error => toast.error(error.message) });
  const close = trpc.issueLog.close.useMutation({ onSuccess: () => { utils.issueLog.list.invalidate(projectInput); toast.success(copy.statusSuccess); }, onError: error => toast.error(error.message) });
  const importBatch = trpc.issueLog.importBatch.useMutation({ onSuccess: count => { utils.issueLog.list.invalidate(projectInput); setImportRows([]); setImportErrors([]); setTitle(""); setDescription(""); setImpactSummary(""); setReferenceNotes(""); setIssueNo(""); setRelationshipIds([]); toast.success(copy.importSuccess(count)); }, onError: error => toast.error(error.message) });

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
  const [activitySearch, setActivitySearch] = useState("");
  const [activityIdPaste, setActivityIdPaste] = useState("");
  const [preview, setPreview] = useState<IssueFragnetProposal | null>(null);
  const [importRows, setImportRows] = useState<ExcelIssueRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  const relationshipOptions = useMemo(() => schedule.relationships.map(relationship => {
    const predecessor = schedule.activities.find(activity => activity.id === relationship.predecessorId);
    const successor = schedule.activities.find(activity => activity.id === relationship.successorId);
    const searchText = `${relationship.id} ${relationship.predecessorId} ${predecessor?.name ?? ""} ${relationship.successorId} ${successor?.name ?? ""} ${relationship.type}`.toLowerCase();
    return { relationship, predecessor, successor, searchText };
  }).filter(option => !relationshipSearch.trim() || option.searchText.includes(relationshipSearch.trim().toLowerCase())), [relationshipSearch, schedule.activities, schedule.relationships]);

  const activityOptions = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    if (!query) return schedule.activities;
    return schedule.activities.filter(activity => `${activity.id} ${activity.name} ${activity.wbs ?? ""} ${activity.wbsId ?? ""}`.toLowerCase().includes(query));
  }, [activitySearch, schedule.activities]);

  if (view !== "issues") return null;
  if (!isAuthenticated) return <section className="issue-log-panel" dir={direction}><div className="issue-log-heading"><div><p className="eyebrow">{copy.plannerIssueLog}</p><h2>{bi(copy.loginHeading, "Schedule-impacting issue log")}</h2><p>{copy.loginDescription}</p></div><ClipboardList size={24} /></div><div className="issue-log-login"><LogIn size={19} /><span>{copy.loginPrompt}</span><Button className="run-button" onClick={startLogin}>{bi(copy.login, "Sign in")}</Button></div></section>;

  const toggleActivity = (id: string) => setAffectedActivityIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleRelationship = (id: string) => setRelationshipIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const addPastedActivities = () => {
    const submittedIds = Array.from(new Set(activityIdPaste.split(/[،,;\s]+/).map(id => id.trim()).filter(Boolean)));
    if (!submittedIds.length) { toast.message(copy.pasteIdsFirst); return; }
    const knownIds = new Set(schedule.activities.map(activity => activity.id));
    const accepted = submittedIds.filter(id => knownIds.has(id));
    const unknown = submittedIds.filter(id => !knownIds.has(id));
    if (!accepted.length) { toast.error(copy.noKnownIds); return; }
    const merged = Array.from(new Set(affectedActivityIds.concat(accepted)));
    if (merged.length > 100) { toast.error(copy.maxActivities); return; }
    setAffectedActivityIds(merged);
    setActivityIdPaste("");
    if (unknown.length) toast.warning(copy.addedWithMissing(accepted.length, unknown.slice(0, 5).join(language === "en" ? ", " : "، "), unknown.length > 5 ? "…" : ""));
    else toast.success(copy.addedActivities(accepted.length));
  };
  const saveRequirements = [
    { label: copy.requirementIssueNo, done: Boolean(issueNo.trim()) }, { label: copy.requirementTitle, done: Boolean(title.trim()) }, { label: copy.requirementDate, done: Boolean(occurrenceDate) }, { label: copy.requirementDuration, done: Number(duration) > 0 }, { label: copy.requirementRelationship, done: relationshipIds.length > 0 }, { label: copy.requirementActivity, done: affectedActivityIds.length > 0 }, { label: copy.requirementDescription, done: description.trim().length >= 10 }, { label: copy.requirementImpact, done: impactSummary.trim().length >= 5 }, { label: copy.requirementEvidence, done: referenceNotes.trim().length >= 3 },
  ];
  const missingRequirements = saveRequirements.filter(item => !item.done).map(item => item.label);
  const canCreate = missingRequirements.length === 0;
  const saveIssue = () => {
    const createInput = (relationshipId: string, index: number) => ({
      issueNo: relationshipIds.length === 1 ? issueNo.trim() : `${issueNo.trim()}-${String(index + 1).padStart(2, "0")}`,
      title: relationshipIds.length === 1 ? title.trim() : `${title.trim()} ${copy.relationshipTitleSuffix(relationshipId)}`,
      description: description.trim(), impactSummary: impactSummary.trim(), referenceNotes: referenceNotes.trim(), occurrenceDate,
      reportedBy: reportedBy.trim() || undefined, responsibleParty: responsibility, delayCause: cause, affectedActivityIds,
      replacedRelationshipId: relationshipId, proposedDurationDays: Number(duration), criticality,
    });
    if (relationshipIds.length === 1) { create.mutate({ projectKey: schedule.id, ...createInput(relationshipIds[0], 0) }); return; }
    importBatch.mutate({ projectKey: schedule.id, issues: relationshipIds.map(createInput) });
  };
  const handleExcel = async (file?: File) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setImportRows([]); setImportErrors([copy.fileTypeError]); return; }
    try {
      const result = parseIssueRegisterExcel(await file.arrayBuffer(), schedule);
      setImportRows(result.errors.length ? [] : result.rows);
      setImportErrors(result.errors);
      if (result.errors.length) toast.error(copy.importFailed(result.errors.length));
      else toast.success(copy.importPreview(result.rows.length));
    } catch { setImportRows([]); setImportErrors([copy.fileReadError]); }
  };
  const exportIssues = () => exportIssueRegisterExcel((issues.data ?? []).map(issue => ({ issueNo: issue.issueNo, title: issue.title, occurrenceDate: dateInput(issue.occurrenceDate), reportedBy: issue.reportedBy ?? undefined, responsibleParty: issue.responsibleParty, delayCause: issue.delayCause, criticality: issue.criticality, proposedDurationDays: Number(issue.proposedDurationDays), replacedRelationshipId: issue.replacedRelationshipId, affectedActivityIds: parseAffectedActivities(issue.affectedActivityIds), description: issue.description, impactSummary: issue.impactSummary, referenceNotes: issue.referenceNotes, status: issue.status })));

  return <section className="issue-log-panel" dir={direction}><div className="issue-log-heading"><div><p className="eyebrow">{copy.plannerIssueLog}</p><h2>{bi(copy.heading, "Schedule-impacting issue register")}</h2><p>{copy.headingDescription}</p></div><ClipboardList size={24} /></div>
    <div className="issue-log-caution"><ShieldCheck size={17} /><span>{copy.caution}</span></div>
    <div className="issue-exchange"><div><Table2 size={20} /><div><b>{bi(copy.excelExchange, "Controlled Excel exchange")}</b><span>{copy.excelHelp}</span></div></div><div className="issue-exchange-actions"><Button variant="outline" onClick={downloadIssueImportTemplate}><Download size={16} />{bi(copy.excelTemplate, "Excel template")}</Button><Button variant="outline" disabled={!issues.data?.length} onClick={exportIssues}><Download size={16} />{bi(copy.exportRegister, "Export register")}</Button><input ref={importInputRef} type="file" accept=".xlsx,.xls" hidden onChange={event => { handleExcel(event.target.files?.[0]); event.currentTarget.value = ""; }} /><Button variant="outline" onClick={() => importInputRef.current?.click()}><FileUp size={16} />{bi(copy.importExcel, "Import Excel")}</Button></div></div>
    {(importErrors.length || importRows.length) ? <div className={`issue-import-preview ${importErrors.length ? "has-errors" : ""}`}>{importErrors.length ? <><b><AlertTriangle size={16} />{copy.importErrors}</b><ul>{importErrors.slice(0, 10).map(error => <li key={error}>{error}</li>)}</ul>{importErrors.length > 10 ? <small>{copy.extraErrors(importErrors.length - 10)}</small> : null}</> : <><b><CheckCircle2 size={16} />{copy.validPreview(importRows.length)}</b><span>{importRows.slice(0, 4).map(row => `${row.issueNo} — ${row.title}`).join(" · ")}{importRows.length > 4 ? " …" : ""}</span><Button className="run-button" disabled={importBatch.isPending} onClick={() => importBatch.mutate({ projectKey: schedule.id, issues: importRows.map(({ rowNumber: _rowNumber, ...issue }) => issue) })}><FileUp size={16} />{copy.confirmBatch}</Button></>}</div> : null}
    <div className="issue-save-guide"><div><b>{copy.beforeSave}</b><span>{copy.beforeSaveHelp}</span></div><div className="issue-requirements">{saveRequirements.map(item => <span key={item.label} className={item.done ? "complete" : "pending"}>{item.done ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{item.label}</span>)}</div></div>
    <div className="issue-form">
      <div><Label>{bi(copy.issueNumber, "Issue number")}</Label><Input value={issueNo} onChange={event => setIssueNo(event.target.value)} placeholder="ISS-001" /></div>
      <div><Label>{bi(copy.issueTitle, "Issue title")}</Label><Input value={title} onChange={event => setTitle(event.target.value)} placeholder={language === "en" ? "Late change instruction" : "تعليمات تغيير متأخرة"} /></div>
      <div><Label>{bi(copy.occurrenceDate, "Occurrence date")}</Label><Input type="date" dir="ltr" value={occurrenceDate} onChange={event => setOccurrenceDate(event.target.value)} /></div>
      <div><Label>{copy.reportedBy}</Label><Input value={reportedBy} onChange={event => setReportedBy(event.target.value)} placeholder={copy.reportedByPlaceholder} /></div>
      <div><Label>{copy.responsibility}</Label><Select value={responsibility} onValueChange={value => setResponsibility(value as typeof responsibility)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="undetermined">{copy.undetermined}</SelectItem><SelectItem value="employer">{copy.responsibilityValues.employer}</SelectItem><SelectItem value="contractor">{copy.responsibilityValues.contractor}</SelectItem><SelectItem value="engineer">{copy.responsibilityValues.engineer}</SelectItem><SelectItem value="third_party">{copy.responsibilityValues.third_party}</SelectItem></SelectContent></Select><small>{copy.responsibilityHelp}</small></div>
      <div><Label>{copy.cause}</Label><Select value={cause} onValueChange={value => setCause(value as typeof cause)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="neutral">{copy.neutral}</SelectItem><SelectItem value="employer">{copy.employerCause}</SelectItem><SelectItem value="contractor">{copy.contractorCause}</SelectItem></SelectContent></Select><small>{copy.causeHelp}</small></div>
      <div><Label>{bi(copy.criticality, "Criticality classification")}</Label><Select value={criticality} onValueChange={value => setCriticality(value as typeof criticality)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">{copy.criticalityValues.unknown}</SelectItem><SelectItem value="potentially_critical">{copy.criticalityValues.potentially_critical}</SelectItem><SelectItem value="critical">{copy.criticalityValues.critical}</SelectItem><SelectItem value="noncritical">{copy.criticalityValues.noncritical}</SelectItem></SelectContent></Select></div>
      <div><Label>{bi(copy.duration, "Proposed Fragnet duration (working days)")}</Label><Input type="number" min="0.01" max="3650" step="0.25" value={duration} onChange={event => setDuration(event.target.value)} /></div>
      <div className="issue-form-wide"><div className="issue-field-heading"><Label>{bi(copy.relationshipPoint, "Relationship point")}</Label><b>{copy.selected(relationshipIds.length)}</b></div><p className="issue-field-help">{copy.relationshipHelp}</p><Input value={relationshipSearch} onChange={event => setRelationshipSearch(event.target.value)} placeholder={copy.relationshipSearch} /><div className="issue-relationship-list">{relationshipOptions.length ? relationshipOptions.map(({ relationship, predecessor, successor }) => <label key={relationship.id} className={relationshipIds.includes(relationship.id) ? "selected" : ""}><input type="checkbox" checked={relationshipIds.includes(relationship.id)} onChange={() => toggleRelationship(relationship.id)} /><span><b>{relationship.id} · {relationship.type}</b><em>{relationship.predecessorId} — {predecessor?.name ?? copy.unreadActivity}</em><i>←</i><em>{relationship.successorId} — {successor?.name ?? copy.unreadActivity}</em></span></label>) : <p>{copy.noRelationship}</p>}</div></div>
      <div className="issue-form-wide"><div className="issue-field-heading"><Label>{bi(copy.affectedActivities, "Affected activities")}</Label><b>{copy.selected(affectedActivityIds.length)}</b></div><p className="issue-field-help">{copy.activityHelp}</p><div className="issue-activity-tools"><Input value={activitySearch} onChange={event => setActivitySearch(event.target.value)} placeholder={copy.activitySearch} /><div><Textarea rows={2} value={activityIdPaste} onChange={event => setActivityIdPaste(event.target.value)} placeholder={copy.pasteIds} /><Button type="button" variant="outline" onClick={addPastedActivities}>{bi(copy.addIds, "Add IDs")}</Button></div></div><div className="issue-activity-pills">{activityOptions.length ? activityOptions.map(activity => <label key={activity.id}><input type="checkbox" checked={affectedActivityIds.includes(activity.id)} onChange={() => toggleActivity(activity.id)} /><span>{activity.id} — {activity.name}{activity.wbs ? ` · ${activity.wbs}` : ""}</span></label>) : <p>{copy.noActivities}</p>}</div></div>
      <div className="issue-form-wide"><Label>{copy.technicalDescription}</Label><Textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder={copy.technicalDescriptionPlaceholder} /></div>
      <div className="issue-form-wide"><Label>{copy.impactSummary}</Label><Textarea rows={2} value={impactSummary} onChange={event => setImpactSummary(event.target.value)} placeholder={copy.impactPlaceholder} /></div>
      <div className="issue-form-wide"><Label>{copy.evidence}</Label><Textarea rows={2} value={referenceNotes} onChange={event => setReferenceNotes(event.target.value)} placeholder={copy.evidencePlaceholder} /></div>
    </div>
    <div className="issue-log-actions"><p><AlertTriangle size={16} /> {canCreate ? relationshipIds.length > 1 ? copy.multipleSaveNotice(relationshipIds.length) : copy.oneSaveNotice : copy.missingSaveNotice(missingRequirements.join(language === "en" ? ", " : "، "))}</p><Button className="run-button" disabled={create.isPending || importBatch.isPending || !canCreate} onClick={saveIssue}><Plus size={16} />{relationshipIds.length > 1 ? copy.saveSeparate(relationshipIds.length) : copy.saveIssue}</Button></div>
    {preview ? <div className="issue-preview"><div><FileCog size={19} /><div><b>{copy.proposalReady} {preview.id}</b><span>{preview.title} · {copy.dayRelationship(String(preview.durationDays), preview.relationshipId)}</span></div></div><p>{copy.affectedLabel} {preview.affectedActivityIds.join(language === "en" ? ", " : "، ")} · {copy.responsibilityLabel} {responsibilityLabel[preview.responsibility]} · {copy.causeLabel} {causeLabel[preview.cause]}</p><Button className="run-button" disabled={recordApplied.isPending} onClick={() => { const row = issues.data?.find(item => item.fragnetProposalJson === JSON.stringify(preview)); if (row) recordApplied.mutate({ id: row.id }); else toast.error(copy.prepareAgain); }}><CheckCircle2 size={16} />{copy.approveInsert}</Button></div> : null}
    <div className="issue-register"><div className="issue-register-title"><b>{copy.register}</b><span>{copy.issueCount(issues.data?.length ?? 0)}</span></div>{issues.isLoading ? <p>{copy.loading}</p> : issues.data?.length ? issues.data.map(issue => { const proposal = parseProposal(issue.fragnetProposalJson); const isPreviewed = preview?.id === proposal?.id; return <article key={issue.id} className={`issue-row status-${issue.status}`}><div className="issue-row-main"><b>{issue.issueNo} — {issue.title}</b><span>{new Date(issue.occurrenceDate).toLocaleDateString(language === "en" ? "en-GB" : "ar-EG", { timeZone: "UTC" })} · {statusLabel[issue.status]} · {criticalityLabel[issue.criticality]}</span><small>{issue.description}</small><small><b>{copy.impactLabel}</b> {issue.impactSummary}</small><small><b>{copy.referencesLabel}</b> {issue.referenceNotes}</small></div><div className="issue-row-meta"><span>{responsibilityLabel[issue.responsibleParty]} · {causeLabel[issue.delayCause]}</span><span>{copy.dayRelationship(String(issue.proposedDurationDays), issue.replacedRelationshipId)}</span></div><div className="issue-row-actions">{issue.status === "open" ? <><Button size="sm" variant="outline" disabled={prepare.isPending} onClick={() => prepare.mutate({ id: issue.id })}><FileCog size={15} />{copy.prepare}</Button><Button size="sm" variant="ghost" disabled={close.isPending} onClick={() => close.mutate({ id: issue.id, status: "rejected" })}><XCircle size={15} />{copy.reject}</Button></> : null}{issue.status === "ready_for_fragnet" && proposal ? <Button size="sm" className="run-button" disabled={recordApplied.isPending} onClick={() => { setPreview(proposal); if (isPreviewed) recordApplied.mutate({ id: issue.id }); else toast.success(copy.reviewThenApprove); }}><CheckCircle2 size={15} />{isPreviewed ? copy.approveApply : copy.showProposal}</Button> : null}{issue.status === "open" || issue.status === "ready_for_fragnet" ? <Button size="sm" variant="ghost" disabled={close.isPending} onClick={() => close.mutate({ id: issue.id, status: "closed" })}>{copy.close}</Button> : null}</div></article>; }) : <p className="issue-empty">{copy.noIssues}</p>}</div>
  </section>;
}
