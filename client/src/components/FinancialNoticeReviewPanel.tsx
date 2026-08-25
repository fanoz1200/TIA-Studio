import { useEffect, useMemo, useState } from "react";
import React from "react";
import {
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileWarning,
  LogIn,
  Send,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { useAppLanguage } from "@/contexts/LanguageContext";
import {
  calculateFinancialImpact,
  resourceAssignmentsForEvent,
  type Fragnet,
  type Schedule,
} from "@/lib/cpm";
import type { AppLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import { ProjectMembersPanel } from "@/components/ProjectMembersPanel";

type View =
  | "guided"
  | "overview"
  | "schedule"
  | "quality"
  | "event"
  | "analysis"
  | "report"
  | "windows"
  | "methods"
  | "financial"
  | "notices"
  | "review"
  | "members"
  | "compare"
  | "resources"
  | "learning"
  | "issues";
type NoticeStatus = "draft" | "under_review" | "sent" | "overdue" | "cancelled";

const uiText = (language: AppLanguage, ar: string, en: string) =>
  language === "en" ? en : ar;

const resourceLabels: Record<AppLanguage, Record<string, string>> = {
  ar: {
    labor: "عمالة",
    nonlabor: "معدات / غير عمالة",
    material: "مواد",
    unknown: "غير مصنف",
  },
  en: {
    labor: "Labour",
    nonlabor: "Plant / non-labour",
    material: "Materials",
    unknown: "Unclassified",
  },
};

const reviewLabels: Record<AppLanguage, Record<string, string>> = {
  ar: {
    draft: "مسودة",
    planning_review: "مراجعة التخطيط",
    contract_review: "مراجعة العقود",
    claims_manager_approval: "اعتماد مدير المطالبات",
    ready_to_export: "جاهزة للتصدير",
    rejected: "مرفوضة",
    in_review: "قيد المراجعة",
    approved: "معتمدة",
    created: "إنشاء",
    submitted: "إحالة",
    commented: "تعليق",
    reopened: "إعادة فتح",
  },
  en: {
    draft: "Draft",
    planning_review: "Planning review",
    contract_review: "Contract review",
    claims_manager_approval: "Claims manager approval",
    ready_to_export: "Ready to export",
    rejected: "Rejected",
    in_review: "In review",
    approved: "Approved",
    created: "Created",
    submitted: "Submitted",
    commented: "Comment added",
    reopened: "Reopened",
  },
};

const noticeStatusLabels: Record<AppLanguage, Record<NoticeStatus, string>> = {
  ar: {
    draft: "مسودة",
    under_review: "قيد المراجعة",
    sent: "مرسل",
    overdue: "متأخر",
    cancelled: "ملغى",
  },
  en: {
    draft: "Draft",
    under_review: "Under review",
    sent: "Sent",
    overdue: "Overdue",
    cancelled: "Cancelled",
  },
};

const dateText = (value: Date | string | null | undefined, language: AppLanguage) =>
  value
    ? new Date(value).toLocaleDateString(language === "en" ? "en-GB" : "ar-EG", {
        timeZone: "UTC",
      })
    : "—";
const money = (value: number, language: AppLanguage) =>
  new Intl.NumberFormat(language === "en" ? "en-GB" : "ar-EG", {
    maximumFractionDigits: 2,
  }).format(value);

export function FinancialNoticeReviewPanel({
  view,
  schedule,
  events,
  selectedEvent,
  activeImpactDays,
  isAuthenticated,
  claimKey: activeClaimKey,
  unifiedNarrative = "",
}: {
  view: View;
  schedule: Schedule;
  events: Fragnet[];
  selectedEvent: Fragnet | null;
  activeImpactDays: number;
  isAuthenticated: boolean;
  claimKey?: string;
  unifiedNarrative?: string;
}) {
  const { language: interfaceLanguage, direction } = useAppLanguage();
  const [noticeNo, setNoticeNo] = useState("N-001");
  const [noticeEventKey, setNoticeEventKey] = useState("");
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [contractClause, setContractClause] = useState("");
  const [awarenessDate, setAwarenessDate] = useState("");
  const [noticeDueDate, setNoticeDueDate] = useState("");
  const [sentDate, setSentDate] = useState("");
  const [noticeStatus, setNoticeStatus] = useState<NoticeStatus>("draft");
  const [noticeNarrative, setNoticeNarrative] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState(7);
  const [noticeDraftLanguage, setNoticeDraftLanguage] = useState<AppLanguage>("ar");
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewerIds, setReviewerIds] = useState<Record<string, string>>({});
  const projectInput = useMemo(
    () => ({ projectKey: schedule.id }),
    [schedule.id]
  );
  const claimKey = useMemo(
    () => activeClaimKey || `${schedule.id}:delay-claim`,
    [activeClaimKey, schedule.id]
  );
  const noticesInput = useMemo(
    () => ({ projectKey: schedule.id, claimKey }),
    [schedule.id, claimKey]
  );
  const reviewInput = useMemo(
    () => ({ projectKey: schedule.id, claimKey }),
    [schedule.id, claimKey]
  );
  const selectedNoticeEvent =
    events.find(event => event.id === noticeEventKey) ?? selectedEvent;
  const effectiveEventKey = selectedNoticeEvent?.id ?? "";
  const eventEvidenceInput = useMemo(
    () => ({
      projectKey: schedule.id,
      eventKey: effectiveEventKey || "no-event",
    }),
    [schedule.id, effectiveEventKey]
  );
  const resources = useMemo(
    () => resourceAssignmentsForEvent(schedule, selectedEvent),
    [schedule, selectedEvent]
  );
  const financial = useMemo(
    () =>
      calculateFinancialImpact(
        Math.max(0, activeImpactDays),
        resources,
        schedule.calendar?.hoursPerDay ?? 8
      ),
    [activeImpactDays, resources, schedule.calendar?.hoursPerDay]
  );
  const eventEvidence = trpc.evidence.list.useQuery(eventEvidenceInput, {
    enabled:
      isAuthenticated && view === "notices" && Boolean(effectiveEventKey),
  });
  const persistedResources = trpc.resourceAssignment.list.useQuery(
    projectInput,
    { enabled: isAuthenticated && view === "financial" }
  );
  const notices = trpc.notice.list.useQuery(noticesInput, {
    enabled: isAuthenticated && (view === "notices" || view === "report"),
  });
  const review = trpc.claimReview.get.useQuery(reviewInput, {
    enabled: isAuthenticated && (view === "review" || view === "report"),
  });
  const projectMembers = trpc.projectMember.list.useQuery(projectInput, {
    enabled: isAuthenticated && view === "review",
  });
  const saveResources = trpc.resourceAssignment.replaceFromImport.useMutation({
    onSuccess: result => {
      persistedResources.refetch();
      toast.success(
        uiText(
          interfaceLanguage,
          `تم حفظ لقطة ${result.saved} إسناد مورد للمشروع.`,
          `${result.saved} resource assignment(s) were saved for this project.`
        )
      );
    },
  });
  const createNotice = trpc.notice.create.useMutation({
    onSuccess: () => {
      notices.refetch();
      toast.success(
        uiText(
          interfaceLanguage,
          "تم إنشاء الإشعار وربطه بالحدث والأدلة المحددة.",
          "The Notice was created and linked to the selected event and evidence."
        )
      );
    },
  });
  const createAutomaticNotice = trpc.notice.createAutomaticDraft.useMutation({
    onSuccess: result => {
      notices.refetch();
      setNoticeNo(result.noticeNo);
      toast.success(
        result.created
          ? uiText(
              interfaceLanguage,
              "تم إنشاء مسودة الإشعار تلقائياً من الحدث.",
              "An automatic Notice draft was created from the event."
            )
          : uiText(
              interfaceLanguage,
              "توجد بالفعل مسودة تلقائية لهذا الحدث؛ تم فتح سجلها.",
              "An automatic draft already exists for this event; its record was opened."
            )
      );
    },
  });
  const startReview = trpc.claimReview.getOrCreate.useMutation({
    onSuccess: () => {
      review.refetch();
      toast.success(
        uiText(
          interfaceLanguage,
          "تم إنشاء مسار مراجعة المطالبة.",
          "The claim review workflow was created."
        )
      );
    },
  });
  const decide = trpc.claimReview.decide.useMutation({
    onSuccess: () => {
      review.refetch();
      setReviewComment("");
      toast.success(
        uiText(
          interfaceLanguage,
          "تم تسجيل قرار المراجعة في سجل التدقيق.",
          "The review decision was recorded in the audit log."
        )
      );
    },
  });
  const assignParticipant = trpc.claimReview.assignParticipant.useMutation({
    onSuccess: () => {
      review.refetch();
      toast.success(
        uiText(
          interfaceLanguage,
          "تم تعيين مراجع المرحلة وتسجيل التعيين في سجل التدقيق.",
          "The stage reviewer was assigned and the assignment was recorded in the audit log."
        )
      );
    },
  });

  useEffect(() => {
    setSelectedEvidenceIds(
      (eventEvidence.data ?? []).map(evidence => String(evidence.id))
    );
  }, [effectiveEventKey, eventEvidence.data]);

  useEffect(() => {
    const assigned = Object.fromEntries(
      (review.data?.participants ?? []).map(participant => [
        participant.stage,
        String(participant.reviewerId),
      ])
    );
    if (Object.keys(assigned).length) setReviewerIds(assigned);
  }, [review.data?.review?.id, review.data?.participants]);

  const concurrencyExcerpt = useMemo(() => {
    const start = unifiedNarrative.indexOf("#### سجل التزامن المدمج");
    const end = unifiedNarrative.indexOf("### 4. الموقف والطلب");
    return start >= 0
      ? unifiedNarrative
          .slice(start, end >= 0 ? end : undefined)
          .replace(/^#### سجل التزامن المدمج\s*/, "")
          .trim()
      : "";
  }, [unifiedNarrative]);

  const resetNoticeFromEvent = () => {
    const next = selectedEvent ?? events[0];
    if (!next) return;
    setNoticeEventKey(next.id);
    setAwarenessDate(next.occurrenceDate);
    setNoticeNarrative(
      noticeDraftLanguage === "en"
        ? `Preliminary notice of the event “${next.title}” dated ${next.occurrenceDate}, with contractual rights reserved pending completion of the technical review.${concurrencyExcerpt ? `\n\nTechnical concurrency summary linked to the claim:\n${concurrencyExcerpt}` : ""}`
        : `إشعار أولي بواقعة «${next.title}» المؤرخة في ${next.occurrenceDate}، مع حفظ الحقوق التعاقدية لحين اكتمال المراجعة الفنية.${concurrencyExcerpt ? `\n\nملخص التزامن الفني المرتبط بالمطالبة:\n${concurrencyExcerpt}` : ""}`
    );
    setNoticeNo(
      `N-${String((notices.data?.length ?? 0) + 1).padStart(3, "0")}`
    );
  };
  const downloadLocalNoticeDraft = () => {
    if (!selectedNoticeEvent) {
      toast.error("اختار واقعة تأخير الأول ثم اضغط «تجهيز مسودة قابلة للتحرير».");
      return;
    }
    if (!noticeNarrative.trim()) {
      toast.error("اكتب وصف الواقعة أو اضغط «تجهيز مسودة قابلة للتحرير» الأول.");
      return;
    }
    const isEnglishDraft = noticeDraftLanguage === "en";
    const unspecified = isEnglishDraft ? "Not specified" : "غير محدد";
    const reviewRequired = isEnglishDraft ? "Review required" : "يُراجع";
    const moneyText = new Intl.NumberFormat(isEnglishDraft ? "en-GB" : "ar-EG", {
      maximumFractionDigits: 2,
    }).format(financial.extensionCost);
    const text = isEnglishDraft
      ? [
          "TIA Studio — Editable Notice Draft",
          "This is a local draft. It is not sent and does not establish contractual entitlement. Review it against the contract with the relevant team before sending.",
          "",
          `Notice no.: ${noticeNo.trim() || unspecified}`,
          `Sender: ${sender.trim() || unspecified}`,
          `Recipient: ${recipient.trim() || unspecified}`,
          `Contract clause: ${contractClause.trim() || reviewRequired}`,
          `Delay event: ${selectedNoticeEvent.id} — ${selectedNoticeEvent.title}`,
          `Event / awareness date: ${awarenessDate || selectedNoticeEvent.occurrenceDate || reviewRequired}`,
          `Notice due date: ${noticeDueDate || "Not specified — review against the contract"}`,
          `Preliminary time impact: ${Math.max(0, activeImpactDays)} day(s)`,
          `Preliminary financial exposure: ${moneyText} currency units`,
          "",
          "Proposed text:",
          noticeNarrative.trim(),
          "",
          "Review checklist before sending:",
          "- Review the awareness date, notice due date, and contract clause.",
          "- Add evidence and attachment references from the evidence register where needed.",
          "- This file is an editable working draft, not a legal conclusion or automatic transmission.",
        ].join("\n")
      : [
          "TIA Studio — مسودة Notice للتعديل",
          "هذه مسودة محلية لا تُرسل ولا تثبت استحقاقاً تعاقدياً. راجعها مع العقد والفريق المختص قبل الإرسال.",
          "",
          `رقم الإشعار: ${noticeNo.trim() || unspecified}`,
          `المرسل: ${sender.trim() || unspecified}`,
          `المرسل إليه: ${recipient.trim() || unspecified}`,
          `البند التعاقدي: ${contractClause.trim() || reviewRequired}`,
          `واقعة التأخير: ${selectedNoticeEvent.id} — ${selectedNoticeEvent.title}`,
          `تاريخ الواقعة / العلم: ${awarenessDate || selectedNoticeEvent.occurrenceDate || reviewRequired}`,
          `تاريخ استحقاق الإشعار: ${noticeDueDate || "غير محدد — راجعه حسب العقد"}`,
          `الأثر الزمني المبدئي: ${Math.max(0, activeImpactDays)} يوم`,
          `الأثر المالي المبدئي: ${moneyText} وحدة نقدية`,
          "",
          "النص المقترح:",
          noticeNarrative.trim(),
          "",
          "ملاحظات قبل الإرسال:",
          "- راجع تاريخ العلم وموعد الإشعار والبند التعاقدي.",
          "- أضف مراجع الأدلة والمرفقات من سجل الأدلة عند الحاجة.",
          "- الملف مسودة للعمل والتعديل، وليس قراراً قانونياً أو إرسالاً تلقائياً.",
        ].join("\n");
    const file = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TIA-Notice-${(noticeNo.trim() || selectedNoticeEvent.id).replace(/[^a-zA-Z0-9_-]/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(
      isEnglishDraft
        ? "The local Notice draft was downloaded. Review and edit it before any sending."
        : "تم تنزيل مسودة Notice محلية. راجعها وعدّلها قبل أي إرسال."
    );
  };
  const toggleEvidence = (id: string) =>
    setSelectedEvidenceIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  const serializedAssignments = (schedule.resourceAssignments ?? []).map(
    ({
      source: _source,
      targetQuantityPerHour: _targetPerHour,
      remainingQuantityPerHour: _remainingPerHour,
      activityRemainingDuration: _duration,
      ...assignment
    }) => assignment
  );
  const reviewLabel = (value: string) =>
    reviewLabels[interfaceLanguage][value] ?? value;

  if (view === "members")
    return (
      <ProjectMembersPanel
        projectKey={schedule.id}
        isAuthenticated={isAuthenticated}
      />
    );

  if (view === "financial")
    return (
      <section className="workflow-panel" dir={direction}>
        <div className="workflow-heading">
          <div>
            <p className="eyebrow">P6 COST EXPOSURE</p>
            <h2>
              {uiText(
                interfaceLanguage,
                "الأثر المالي التشغيلي",
                "Operational financial exposure"
              )}
            </h2>
            <p>
              {uiText(
                interfaceLanguage,
                "يُحسب محلياً من إسنادات P6 المرتبطة بحدث الـ Fragnet ونقطتي اتصال الحدث ببرنامج الأساس، لا من جميع موارد المشروع.",
                "Calculated locally from P6 assignments linked to the Fragnet event and its two baseline connection points, not from all project resources."
              )}
            </p>
          </div>
          <WalletCards size={23} />
        </div>
        <div className="workflow-metrics">
          <div>
            <span>{uiText(interfaceLanguage, "إسنادات ضمن نطاق الحدث", "Assignments within the event scope")}</span>
            <b>{resources.length}</b>
            <small>
              {selectedEvent
                ? uiText(interfaceLanguage, `الحدث: ${selectedEvent.id}`, `Event: ${selectedEvent.id}`)
                : uiText(interfaceLanguage, "كل البرنامج لعدم تحديد حدث", "Entire schedule because no event is selected")}
            </small>
          </div>
          <div>
            <span>{uiText(interfaceLanguage, "التكلفة اليومية", "Daily cost")}</span>
            <b>{money(financial.dailyCost, interfaceLanguage)}</b>
            <small>{uiText(interfaceLanguage, "وحدة نقدية حسب ملف P6", "Currency units from the P6 file")}</small>
          </div>
          <div className="is-accent">
            <span>{uiText(interfaceLanguage, "تعرض التمديد", "Extension exposure")}</span>
            <b>{money(financial.extensionCost, interfaceLanguage)}</b>
            <small>{uiText(interfaceLanguage, `${Math.max(0, activeImpactDays)} يوم تأخير محسوب`, `${Math.max(0, activeImpactDays)} calculated delay day(s)`)}</small>
          </div>
        </div>
        <div className="financial-breakdown">
          {Object.entries(financial.byResourceType).map(([type, bucket]) => (
            <div key={type}>
              <span>{resourceLabels[interfaceLanguage][type] ?? resourceLabels[interfaceLanguage].unknown}</span>
              <b>{uiText(interfaceLanguage, `${bucket.assignmentCount} إسناد`, `${bucket.assignmentCount} assignment(s)`)}</b>
              <small>
                {uiText(interfaceLanguage, "يومي", "Daily")}: {money(bucket.dailyCost, interfaceLanguage)} · {uiText(interfaceLanguage, "تمديد", "Extension")}:{" "}
                {money(bucket.extensionCost, interfaceLanguage)}
              </small>
            </div>
          ))}
        </div>
        {selectedEvent && !resources.length ? (
          <div className="workflow-warning">
            <FileWarning size={18} />
            <div>
              <b>{uiText(interfaceLanguage, "لا توجد إسنادات في نطاق الحدث", "No assignments are within the event scope")}</b>
              <p>
                {uiText(
                  interfaceLanguage,
                  "لم تتطابق إسنادات الموارد المستوردة مع أنشطة الـ Fragnet أو نقطتي ربطه ببرنامج الأساس. راجع معرفات الأنشطة قبل استخدام أي قيمة مالية.",
                  "Imported resource assignments did not match the Fragnet activities or its two baseline connection points. Review activity IDs before using a financial value."
                )}
              </p>
            </div>
          </div>
        ) : null}
        {financial.warnings.length ? (
          <div className="workflow-warning">
            <FileWarning size={18} />
            <div>
              <b>{uiText(interfaceLanguage, "تنبيهات جودة بيانات التكلفة", "Cost-data quality warnings")}</b>
              <p>{financial.warnings.join(" ")}</p>
            </div>
          </div>
        ) : null}
        <div className="workflow-footer">
          <p>
            {uiText(
              interfaceLanguage,
              "هذه قيمة تخطيطية لتقدير التعرض المالي. لا تمثل مبلغ مطالبة نهائياً أو قرار استحقاق تعاقدي.",
              "This is a planning value for estimating financial exposure. It is not a final claim amount or a contractual entitlement decision."
            )}
          </p>
          {isAuthenticated ? (
            <Button
              className="run-button"
              disabled={
                !serializedAssignments.length || saveResources.isPending
              }
              onClick={() =>
                saveResources.mutate({
                  projectKey: schedule.id,
                  sourceFormat:
                    schedule.source === "xer"
                      ? "xer"
                      : schedule.source === "p6-xml"
                        ? "p6-xml"
                        : "manual",
                  assignments: serializedAssignments,
                })
              }
            >
              <Database size={16} />
              {uiText(interfaceLanguage, "حفظ لقطة الموارد", "Save resource snapshot")}
            </Button>
          ) : (
            <Button variant="outline" onClick={startLogin}>
              <LogIn size={16} />
              {uiText(interfaceLanguage, "تسجيل الدخول للحفظ", "Sign in to save")}
            </Button>
          )}
        </div>
        {isAuthenticated && persistedResources.data ? (
          <p className="workflow-subtle">
            {uiText(
              interfaceLanguage,
              `آخر لقطة محفوظة: ${persistedResources.data.length} إسناد مورد خاص بهذا المشروع.`,
              `Latest saved snapshot: ${persistedResources.data.length} resource assignment(s) for this project.`
            )}
          </p>
        ) : null}
      </section>
    );

  if (view === "notices")
    return (
      <section className="workflow-panel" dir={direction}>
        <div className="workflow-heading">
          <div>
            <p className="eyebrow">NOTICE REGISTER</p>
            <h2>{uiText(interfaceLanguage, "سجل الإشعارات التعاقدية", "Contractual Notice register")}</h2>
            <p>
              {uiText(interfaceLanguage, "يُنشئ مسودة مرتبطة بالحدث مع تاريخ العلم والاستحقاق والأدلة. لا يرسل التطبيق مراسلات خارجية أو يقرر الاستحقاق التعاقدي.", "Creates a draft linked to the event, awareness date, due date, and evidence. The application does not send external communications or decide contractual entitlement.")}
            </p>
          </div>
          <BellRing size={23} />
        </div>
        {!isAuthenticated ? (
          <div className="workflow-login">
            <LogIn size={18} />
            <span>
              {uiText(interfaceLanguage, "تقدر تجهز وتنزل مسودة محلية من غير حساب. سجّل الدخول فقط لو عايز تحفظ الإشعار وتتابع سجله وأدلته داخل المشروع.", "You can prepare and download a local draft without an account. Sign in only to save the Notice and track its record and evidence inside the project.")}
            </span>
            <Button className="run-button" onClick={startLogin}>
              {uiText(interfaceLanguage, "تسجيل الدخول", "Sign in")}
            </Button>
          </div>
        ) : null}
            <div className="workflow-toolbar">
              <Button variant="outline" onClick={resetNoticeFromEvent}>
                {uiText(interfaceLanguage, "تجهيز مسودة قابلة للتحرير", "Prepare editable draft")}
              </Button>
              <span>
                {uiText(interfaceLanguage, `أثر الحدث: ${Math.max(0, activeImpactDays)} يوم · ${money(financial.extensionCost, interfaceLanguage)} وحدة نقدية`, `Event impact: ${Math.max(0, activeImpactDays)} day(s) · ${money(financial.extensionCost, interfaceLanguage)} currency units`)}
              </span>
            </div>
            <div className="notice-form">
              <div>
                <Label>{uiText(interfaceLanguage, "رقم الإشعار", "Notice number")}</Label>
                <Input
                  value={noticeNo}
                  onChange={event => setNoticeNo(event.target.value)}
                  placeholder="N-001"
                />
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "حدث التأخير المرجعي", "Reference delay event")}</Label>
                <Select
                  value={noticeEventKey || selectedEvent?.id || "none"}
                  onValueChange={value =>
                    setNoticeEventKey(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={uiText(interfaceLanguage, "اختر حدثاً", "Choose an event")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{uiText(interfaceLanguage, "اختر حدثاً", "Choose an event")}</SelectItem>
                    {events.map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.id} — {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "مدة الإشعار التعاقدية (يوم)", "Contractual Notice period (days)")}</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  value={noticePeriodDays}
                  onChange={event =>
                    setNoticePeriodDays(
                      Math.max(0, Number(event.target.value) || 0)
                    )
                  }
                />
              </div>
              <div>
                <Label>
                  {interfaceLanguage === "en"
                    ? "Draft language"
                    : "لغة مسودة التنزيل"}
                </Label>
                <Select
                  value={noticeDraftLanguage}
                  onValueChange={value =>
                    setNoticeDraftLanguage(value as AppLanguage)
                  }
                >
                  <SelectTrigger
                    aria-label={
                      interfaceLanguage === "en"
                        ? "Draft language"
                        : "لغة مسودة التنزيل"
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "المرسل", "Sender")}</Label>
                <Input
                  value={sender}
                  onChange={event => setSender(event.target.value)}
                  placeholder={uiText(interfaceLanguage, "المقاول", "Contractor")}
                />
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "المستلم", "Recipient")}</Label>
                <Input
                  value={recipient}
                  onChange={event => setRecipient(event.target.value)}
                  placeholder={uiText(interfaceLanguage, "المهندس / صاحب العمل", "Engineer / Employer")}
                />
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "بند العقد", "Contract clause")}</Label>
                <Input
                  value={contractClause}
                  onChange={event => setContractClause(event.target.value)}
                  placeholder={uiText(interfaceLanguage, "مثال: 8.4", "Example: 8.4")}
                />
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "الحالة", "Status")}</Label>
                <Select
                  value={noticeStatus}
                  onValueChange={value =>
                    setNoticeStatus(value as NoticeStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{noticeStatusLabels[interfaceLanguage].draft}</SelectItem>
                    <SelectItem value="under_review">{noticeStatusLabels[interfaceLanguage].under_review}</SelectItem>
                    <SelectItem value="sent">{noticeStatusLabels[interfaceLanguage].sent}</SelectItem>
                    <SelectItem value="overdue">{noticeStatusLabels[interfaceLanguage].overdue}</SelectItem>
                    <SelectItem value="cancelled">{noticeStatusLabels[interfaceLanguage].cancelled}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "تاريخ العلم", "Awareness date")}</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={awarenessDate}
                  onChange={event => setAwarenessDate(event.target.value)}
                />
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "آخر موعد للإشعار", "Notice due date")}</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={noticeDueDate}
                  onChange={event => setNoticeDueDate(event.target.value)}
                />
              </div>
              <div>
                <Label>{uiText(interfaceLanguage, "تاريخ الإرسال", "Sent date")}</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={sentDate}
                  onChange={event => setSentDate(event.target.value)}
                />
              </div>
              <div className="notice-form-wide">
                <Label>{uiText(interfaceLanguage, "الأدلة المرجعية للحدث", "Event evidence references")}</Label>
                {eventEvidence.isLoading ? (
                  <p className="workflow-subtle">{uiText(interfaceLanguage, "جار تحميل أدلة الحدث…", "Loading event evidence…")}</p>
                ) : eventEvidence.data?.length ? (
                  <div className="evidence-reference-list">
                    {eventEvidence.data.map(evidence => (
                      <label key={evidence.id}>
                        <input
                          type="checkbox"
                          checked={selectedEvidenceIds.includes(
                            String(evidence.id)
                          )}
                          onChange={() => toggleEvidence(String(evidence.id))}
                        />
                        <span>
                          {evidence.title}{" "}
                          <small>({evidence.evidenceType})</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="workflow-subtle">
                    {uiText(interfaceLanguage, "لا توجد أدلة محفوظة لهذا الحدث. يمكن ربطها لاحقاً من سجل الأدلة.", "No evidence has been saved for this event. It can be linked later from the evidence register.")}
                  </p>
                )}
              </div>
              <div className="notice-form-wide">
                <Label>{uiText(interfaceLanguage, "السرد المختصر وحفظ الحقوق", "Brief narrative and reservation of rights")}</Label>
                <Textarea
                  rows={3}
                  value={noticeNarrative}
                  onChange={event => setNoticeNarrative(event.target.value)}
                  placeholder={uiText(interfaceLanguage, "وصف موجز للواقعة وأثرها المبدئي وحفظ الحقوق…", "Briefly describe the event, its preliminary impact, and the reservation of rights…")}
                />
              </div>
            </div>
            <div className="workflow-footer">
              <p>
                {uiText(interfaceLanguage, "المسودة المحلية لا تُرسل مراسلة ولا تثبت استحقاقاً. راجع التاريخ والبند والنص والعقد قبل أي إرسال أو حفظ رسمي.", "The local draft does not send a communication or establish entitlement. Review the date, clause, text, and contract before any sending or formal saving.")}
              </p>
              <div className="workflow-actions">
                <Button
                  variant="outline"
                  disabled={!selectedNoticeEvent || !noticeNarrative.trim()}
                  onClick={downloadLocalNoticeDraft}
                >
                  <Download size={16} />
                  {interfaceLanguage === "en"
                    ? "Download local Notice draft"
                    : "تنزيل مسودة Notice محلية"}
                </Button>
                {isAuthenticated ? (
                  <>
                <Button
                  variant="outline"
                  disabled={
                    createAutomaticNotice.isPending || !selectedNoticeEvent
                  }
                  onClick={() =>
                    createAutomaticNotice.mutate({
                      projectKey: schedule.id,
                      claimKey,
                      eventKey: effectiveEventKey,
                      eventTitle: selectedNoticeEvent!.title,
                      awarenessDate: selectedNoticeEvent!.occurrenceDate,
                      noticePeriodDays,
                      timeImpactDays: Math.max(0, activeImpactDays),
                      costImpact: financial.extensionCost,
                      evidenceReferenceIds: selectedEvidenceIds,
                    })
                  }
                >
                  <BellRing size={16} />
                  {uiText(interfaceLanguage, "إنشاء مسودة تلقائية", "Create automatic draft")}
                </Button>
                <Button
                  className="run-button"
                  disabled={
                    createNotice.isPending ||
                    !effectiveEventKey ||
                    !noticeNo.trim() ||
                    !noticeNarrative.trim()
                  }
                  onClick={() =>
                    createNotice.mutate({
                      projectKey: schedule.id,
                      claimKey,
                      eventKey: effectiveEventKey,
                      noticeNo: noticeNo.trim(),
                      sender,
                      recipient,
                      contractClause,
                      awarenessDate: awarenessDate || null,
                      noticeDueDate: noticeDueDate || null,
                      sentDate: sentDate || null,
                      status: noticeStatus,
                      narrative: noticeNarrative.trim(),
                      timeImpactDays: Math.max(0, activeImpactDays),
                      costImpact: financial.extensionCost,
                      evidenceReferenceIds: selectedEvidenceIds,
                    })
                  }
                >
                  <Send size={16} />
                  {uiText(interfaceLanguage, "حفظ الإشعار", "Save Notice")}
                </Button>
                  </>
                ) : (
                  <p className="workflow-subtle">
                    {uiText(interfaceLanguage, "الحفظ في السجل ومراجع الأدلة يحتاجان تسجيل الدخول؛ التنزيل المحلي متاح الآن.", "Saving to the register and evidence references requires signing in; local download is available now.")}
                  </p>
                )}
              </div>
            </div>
            {isAuthenticated ? (
            <div className="notice-register">
              {notices.isLoading ? (
                <span>{uiText(interfaceLanguage, "جار تحميل السجل…", "Loading the register…")}</span>
              ) : notices.data?.length ? (
                notices.data.map(notice => (
                  <div key={notice.id}>
                    <b>{notice.noticeNo}</b>
                    <span>
                      {notice.eventKey} · {noticeStatusLabels[interfaceLanguage][notice.computedStatus as NoticeStatus] ?? notice.computedStatus} · {uiText(interfaceLanguage, "استحقاق", "Due")}: {dateText(notice.noticeDueDate, interfaceLanguage)}
                    </span>
                    <small>{notice.narrative}</small>
                    <small>
                      {uiText(interfaceLanguage, "مراجع الأدلة", "Evidence references")}:{" "}
                      {notice.evidenceReferenceIds
                        ? JSON.parse(notice.evidenceReferenceIds).length
                        : 0}
                    </small>
                  </div>
                ))
              ) : (
                <span>{uiText(interfaceLanguage, "لم يتم إنشاء Notices لهذا المشروع بعد.", "No Notices have been created for this project yet.")}</span>
              )}
            </div>
            ) : null}
      </section>
    );

  if (view === "review") {
    const current = review.data?.review;
    const audit = review.data?.audit ?? [];
    const action = !current
      ? null
      : current.currentStage === "draft"
        ? "submitted"
        : current.currentStage === "planning_review" ||
            current.currentStage === "contract_review" ||
            current.currentStage === "claims_manager_approval"
          ? "approved"
          : current.currentStage === "rejected"
            ? "reopened"
            : null;
    const participantStages = [
      "planning_review",
      "contract_review",
      "claims_manager_approval",
    ] as const;
    return (
      <section className="workflow-panel" dir={direction}>
        <div className="workflow-heading">
          <div>
            <p className="eyebrow">ELECTRONIC CLAIM REVIEW</p>
            <h2>{uiText(interfaceLanguage, "مسار الاعتماد الإلكتروني", "Electronic approval workflow")}</h2>
            <p>
              {uiText(interfaceLanguage, "مسودة ← مراجعة التخطيط ← مراجعة العقود ← اعتماد مدير المطالبات ← جاهزة للتصدير. لا يجيز النظام قرار المرحلة إلا للمراجع المعيّن لها.", "Draft → planning review → contract review → claims manager approval → ready to export. The system permits a stage decision only to its assigned reviewer.")}
            </p>
          </div>
          <ClipboardCheck size={23} />
        </div>
        {!isAuthenticated ? (
          <div className="workflow-login">
            <LogIn size={18} />
            <span>{uiText(interfaceLanguage, "سجّل الدخول لإنشاء مسار المراجعة وحفظ قراراته.", "Sign in to create the review workflow and save its decisions.")}</span>
            <Button className="run-button" onClick={startLogin}>
              {uiText(interfaceLanguage, "تسجيل الدخول", "Sign in")}
            </Button>
          </div>
        ) : !current ? (
          <div className="workflow-empty">
            <p>{uiText(interfaceLanguage, "لا يوجد مسار اعتماد لهذه المطالبة بعد.", "There is no approval workflow for this claim yet.")}</p>
            <Button
              className="run-button"
              disabled={startReview.isPending}
              onClick={() =>
                startReview.mutate({
                  projectKey: schedule.id,
                  claimKey,
                  claimTitle: `${schedule.name} — ${uiText(interfaceLanguage, "مطالبة TIA", "TIA claim")}`,
                })
              }
            >
              <CheckCircle2 size={16} />
              {uiText(interfaceLanguage, "إنشاء مسار الاعتماد", "Create approval workflow")}
            </Button>
          </div>
        ) : (
          <>
            <div className="review-steps">
              {[
                "draft",
                "planning_review",
                "contract_review",
                "claims_manager_approval",
                "ready_to_export",
              ].map(stage => (
                <div
                  key={stage}
                  className={current.currentStage === stage ? "current" : ""}
                >
                  <i>
                    {stage === "draft"
                      ? "1"
                      : stage === "planning_review"
                        ? "2"
                        : stage === "contract_review"
                          ? "3"
                          : stage === "claims_manager_approval"
                            ? "4"
                            : "5"}
                  </i>
                  <span>{reviewLabel(stage)}</span>
                </div>
              ))}
            </div>
            <div className="review-status">
              <b>{uiText(interfaceLanguage, "الحالة", "Status")}: {reviewLabel(current.status)}</b>
              <span>
                {uiText(interfaceLanguage, "المرحلة الحالية", "Current stage")}: {reviewLabel(current.currentStage)}
              </span>
            </div>
            {review.data?.isOwner ? (
              <div className="review-assignments">
                <h3>{uiText(interfaceLanguage, "تعيين مراجعي المراحل", "Assign stage reviewers")}</h3>
                <p>
                  {uiText(interfaceLanguage, "أضف الأعضاء من لوحة «أعضاء المشروع» ثم اختر الاسم المناسب لكل مرحلة. يسجل النظام الإسناد في سجل التدقيق.", "Add members from the Project members panel, then choose the appropriate person for each stage. The system records the assignment in the audit log.")}
                </p>
                {participantStages.map(stage => (
                  <div key={stage}>
                    <Label>{reviewLabel(stage)}</Label>
                    <Select
                      value={reviewerIds[stage] ?? "unassigned"}
                      onValueChange={value =>
                        setReviewerIds(currentIds => ({
                          ...currentIds,
                          [stage]: value === "unassigned" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={uiText(interfaceLanguage, "اختر عضواً", "Choose a member")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">{uiText(interfaceLanguage, "اختر عضواً", "Choose a member")}</SelectItem>
                        {projectMembers.data?.map(member => (
                          <SelectItem
                            key={member.memberUserId}
                            value={String(member.memberUserId)}
                          >
                            {member.name} —{" "}
                            {member.isOwner
                              ? uiText(interfaceLanguage, "مالك المشروع", "Project owner")
                              : member.projectRole}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      disabled={
                        assignParticipant.isPending ||
                        !Number(reviewerIds[stage])
                      }
                      onClick={() =>
                        assignParticipant.mutate({
                          reviewId: current.id,
                          stage,
                          reviewerId: Number(reviewerIds[stage]),
                        })
                      }
                    >
                      {uiText(interfaceLanguage, "حفظ المراجع", "Save reviewer")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="workflow-subtle">
                {uiText(interfaceLanguage, "يخضع قرارك لصلاحية التعيين المسجلة لهذه المرحلة.", "Your decision is subject to the assignment authority recorded for this stage.")}
              </p>
            )}
            {current.currentStage !== "ready_to_export" ? (
              <>
                <Label>{uiText(interfaceLanguage, "تعليق القرار (اختياري)", "Decision comment (optional)")}</Label>
                <Textarea
                  rows={2}
                  value={reviewComment}
                  onChange={event => setReviewComment(event.target.value)}
                  placeholder={uiText(interfaceLanguage, "سبب القرار أو ملاحظة المراجع…", "Reason for the decision or reviewer note…")}
                />
                <div className="review-actions">
                  {action ? (
                    <Button
                      className="run-button"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({
                          reviewId: current.id,
                          decision: action,
                          comment: reviewComment || undefined,
                        })
                      }
                    >
                      {action === "submitted"
                        ? uiText(interfaceLanguage, "إحالة إلى التخطيط", "Submit to planning")
                        : action === "reopened"
                          ? uiText(interfaceLanguage, "إعادة فتح المسار", "Reopen workflow")
                          : uiText(interfaceLanguage, "اعتماد والانتقال للمرحلة التالية", "Approve and move to the next stage")}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        reviewId: current.id,
                        decision: "commented",
                        comment:
                          reviewComment ||
                          uiText(interfaceLanguage, "تمت إضافة ملاحظة دون تغيير المرحلة.", "A note was added without changing the stage."),
                      })
                    }
                  >
                    {uiText(interfaceLanguage, "تسجيل تعليق", "Record comment")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        reviewId: current.id,
                        decision: "rejected",
                        comment: reviewComment || uiText(interfaceLanguage, "تم رفض المراجعة.", "The review was rejected."),
                      })
                    }
                  >
                    {uiText(interfaceLanguage, "رفض", "Reject")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="workflow-ready">
                <CheckCircle2 size={20} />
                <span>
                  {uiText(interfaceLanguage, "المطالبة جاهزة للتصدير. ستظهر حالة الاعتماد في التقرير عند التصدير.", "The claim is ready to export. The approval status will appear in the report when it is exported.")}
                </span>
              </div>
            )}
            <div className="audit-log">
              <h3>{uiText(interfaceLanguage, "سجل التدقيق غير القابل للتحرير", "Immutable audit log")}</h3>
              {audit.map(entry => (
                <div key={entry.id}>
                  <b>{reviewLabel(entry.decision)}</b>
                  <span>
                    {reviewLabel(entry.stage)} · {entry.reviewerName || entry.reviewerEmail || uiText(interfaceLanguage, "مستخدم", "User")} · {dateText(entry.recordedAt, interfaceLanguage)}
                  </span>
                  <small>{entry.comment || uiText(interfaceLanguage, "دون تعليق", "No comment")}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    );
  }
  return null;
}
