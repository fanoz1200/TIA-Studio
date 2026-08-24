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

const resourceLabels = {
  labor: "عمالة",
  nonlabor: "معدات / غير عمالة",
  material: "مواد",
  unknown: "غير مصنف",
};
const reviewLabels: Record<string, string> = {
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
};
const dateText = (value?: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString("ar-EG", { timeZone: "UTC" })
    : "—";
const money = (value: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value);

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
  const { language: interfaceLanguage } = useAppLanguage();
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
      toast.success(`تم حفظ لقطة ${result.saved} إسناد مورد للمشروع.`);
    },
  });
  const createNotice = trpc.notice.create.useMutation({
    onSuccess: () => {
      notices.refetch();
      toast.success("تم إنشاء الإشعار وربطه بالحدث والأدلة المحددة.");
    },
  });
  const createAutomaticNotice = trpc.notice.createAutomaticDraft.useMutation({
    onSuccess: result => {
      notices.refetch();
      setNoticeNo(result.noticeNo);
      toast.success(
        result.created
          ? "تم إنشاء مسودة الإشعار تلقائياً من الحدث."
          : "توجد بالفعل مسودة تلقائية لهذا الحدث؛ تم فتح سجلها."
      );
    },
  });
  const startReview = trpc.claimReview.getOrCreate.useMutation({
    onSuccess: () => {
      review.refetch();
      toast.success("تم إنشاء مسار مراجعة المطالبة.");
    },
  });
  const decide = trpc.claimReview.decide.useMutation({
    onSuccess: () => {
      review.refetch();
      setReviewComment("");
      toast.success("تم تسجيل قرار المراجعة في سجل التدقيق.");
    },
  });
  const assignParticipant = trpc.claimReview.assignParticipant.useMutation({
    onSuccess: () => {
      review.refetch();
      toast.success("تم تعيين مراجع المرحلة وتسجيل التعيين في سجل التدقيق.");
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

  if (view === "members")
    return (
      <ProjectMembersPanel
        projectKey={schedule.id}
        isAuthenticated={isAuthenticated}
      />
    );

  if (view === "financial")
    return (
      <section className="workflow-panel">
        <div className="workflow-heading">
          <div>
            <p className="eyebrow">P6 COST EXPOSURE</p>
            <h2>الأثر المالي التشغيلي</h2>
            <p>
              يحسب محلياً من إسنادات P6 المرتبطة بحدث الـ Fragnet ونقطتي اتصال
              الحدث ببرنامج الأساس، لا من جميع موارد المشروع.
            </p>
          </div>
          <WalletCards size={23} />
        </div>
        <div className="workflow-metrics">
          <div>
            <span>إسنادات ضمن نطاق الحدث</span>
            <b>{resources.length}</b>
            <small>
              {selectedEvent
                ? `الحدث: ${selectedEvent.id}`
                : "كل البرنامج لعدم تحديد حدث"}
            </small>
          </div>
          <div>
            <span>التكلفة اليومية</span>
            <b>{money(financial.dailyCost)}</b>
            <small>وحدة نقدية حسب ملف P6</small>
          </div>
          <div className="is-accent">
            <span>تعرض التمديد</span>
            <b>{money(financial.extensionCost)}</b>
            <small>{Math.max(0, activeImpactDays)} يوم تأخير محسوب</small>
          </div>
        </div>
        <div className="financial-breakdown">
          {Object.entries(financial.byResourceType).map(([type, bucket]) => (
            <div key={type}>
              <span>{resourceLabels[type as keyof typeof resourceLabels]}</span>
              <b>{bucket.assignmentCount} إسناد</b>
              <small>
                يومي: {money(bucket.dailyCost)} · تمديد:{" "}
                {money(bucket.extensionCost)}
              </small>
            </div>
          ))}
        </div>
        {selectedEvent && !resources.length ? (
          <div className="workflow-warning">
            <FileWarning size={18} />
            <div>
              <b>لا توجد إسنادات في نطاق الحدث</b>
              <p>
                لم تتطابق إسنادات الموارد المستوردة مع أنشطة الـ Fragnet أو
                نقطتي ربطه ببرنامج الأساس. راجع معرفات الأنشطة قبل استخدام أي
                قيمة مالية.
              </p>
            </div>
          </div>
        ) : null}
        {financial.warnings.length ? (
          <div className="workflow-warning">
            <FileWarning size={18} />
            <div>
              <b>تنبيهات جودة بيانات التكلفة</b>
              <p>{financial.warnings.join(" ")}</p>
            </div>
          </div>
        ) : null}
        <div className="workflow-footer">
          <p>
            هذه قيمة تخطيطية لتقدير التعرض المالي. لا تمثل مبلغ مطالبة نهائياً
            أو قرار استحقاق تعاقدي.
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
              حفظ لقطة الموارد
            </Button>
          ) : (
            <Button variant="outline" onClick={startLogin}>
              <LogIn size={16} />
              تسجيل الدخول للحفظ
            </Button>
          )}
        </div>
        {isAuthenticated && persistedResources.data ? (
          <p className="workflow-subtle">
            آخر لقطة محفوظة: {persistedResources.data.length} إسناد مورد خاص
            بهذا المشروع.
          </p>
        ) : null}
      </section>
    );

  if (view === "notices")
    return (
      <section className="workflow-panel">
        <div className="workflow-heading">
          <div>
            <p className="eyebrow">NOTICE REGISTER</p>
            <h2>سجل الإشعارات التعاقدية</h2>
            <p>
              ينشئ مسودة مرتبطة بالحدث مع تاريخ العلم والاستحقاق والأدلة. لا
              يرسل التطبيق مراسلات خارجية أو يقرر الاستحقاق التعاقدي.
            </p>
          </div>
          <BellRing size={23} />
        </div>
        {!isAuthenticated ? (
          <div className="workflow-login">
            <LogIn size={18} />
            <span>
              تقدر تجهز وتنزل مسودة محلية من غير حساب. سجّل الدخول فقط لو عايز
              تحفظ الإشعار وتتابع سجله وأدلته داخل المشروع.
            </span>
            <Button className="run-button" onClick={startLogin}>
              تسجيل الدخول
            </Button>
          </div>
        ) : null}
            <div className="workflow-toolbar">
              <Button variant="outline" onClick={resetNoticeFromEvent}>
                تجهيز مسودة قابلة للتحرير
              </Button>
              <span>
                أثر الحدث: {Math.max(0, activeImpactDays)} يوم ·{" "}
                {money(financial.extensionCost)} وحدة نقدية
              </span>
            </div>
            <div className="notice-form">
              <div>
                <Label>رقم الإشعار</Label>
                <Input
                  value={noticeNo}
                  onChange={event => setNoticeNo(event.target.value)}
                  placeholder="N-001"
                />
              </div>
              <div>
                <Label>حدث التأخير المرجعي</Label>
                <Select
                  value={noticeEventKey || selectedEvent?.id || "none"}
                  onValueChange={value =>
                    setNoticeEventKey(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر حدثاً" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">اختر حدثاً</SelectItem>
                    {events.map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.id} — {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>مدة الإشعار التعاقدية (يوم)</Label>
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
                <Label>المرسل</Label>
                <Input
                  value={sender}
                  onChange={event => setSender(event.target.value)}
                  placeholder="المقاول"
                />
              </div>
              <div>
                <Label>المستلم</Label>
                <Input
                  value={recipient}
                  onChange={event => setRecipient(event.target.value)}
                  placeholder="المهندس / صاحب العمل"
                />
              </div>
              <div>
                <Label>بند العقد</Label>
                <Input
                  value={contractClause}
                  onChange={event => setContractClause(event.target.value)}
                  placeholder="مثال: 8.4"
                />
              </div>
              <div>
                <Label>الحالة</Label>
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
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="under_review">قيد المراجعة</SelectItem>
                    <SelectItem value="sent">مرسل</SelectItem>
                    <SelectItem value="overdue">متأخر</SelectItem>
                    <SelectItem value="cancelled">ملغى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>تاريخ العلم</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={awarenessDate}
                  onChange={event => setAwarenessDate(event.target.value)}
                />
              </div>
              <div>
                <Label>آخر موعد للإشعار</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={noticeDueDate}
                  onChange={event => setNoticeDueDate(event.target.value)}
                />
              </div>
              <div>
                <Label>تاريخ الإرسال</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={sentDate}
                  onChange={event => setSentDate(event.target.value)}
                />
              </div>
              <div className="notice-form-wide">
                <Label>الأدلة المرجعية للحدث</Label>
                {eventEvidence.isLoading ? (
                  <p className="workflow-subtle">جار تحميل أدلة الحدث…</p>
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
                    لا توجد أدلة محفوظة لهذا الحدث. يمكن ربطها لاحقاً من سجل
                    الأدلة.
                  </p>
                )}
              </div>
              <div className="notice-form-wide">
                <Label>السرد المختصر وحفظ الحقوق</Label>
                <Textarea
                  rows={3}
                  value={noticeNarrative}
                  onChange={event => setNoticeNarrative(event.target.value)}
                  placeholder="وصف موجز للواقعة وأثرها المبدئي وحفظ الحقوق…"
                />
              </div>
            </div>
            <div className="workflow-footer">
              <p>
                المسودة المحلية لا تُرسل مراسلة ولا تثبت استحقاقاً. راجع التاريخ
                والبند والنص والعقد قبل أي إرسال أو حفظ رسمي.
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
                  إنشاء مسودة تلقائية
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
                  حفظ الإشعار
                </Button>
                  </>
                ) : (
                  <p className="workflow-subtle">
                    الحفظ في السجل ومراجع الأدلة يحتاجان تسجيل الدخول؛ التنزيل
                    المحلي متاح الآن.
                  </p>
                )}
              </div>
            </div>
            {isAuthenticated ? (
            <div className="notice-register">
              {notices.isLoading ? (
                <span>جار تحميل السجل…</span>
              ) : notices.data?.length ? (
                notices.data.map(notice => (
                  <div key={notice.id}>
                    <b>{notice.noticeNo}</b>
                    <span>
                      {notice.eventKey} · {notice.computedStatus} · استحقاق:{" "}
                      {dateText(notice.noticeDueDate)}
                    </span>
                    <small>{notice.narrative}</small>
                    <small>
                      مراجع الأدلة:{" "}
                      {notice.evidenceReferenceIds
                        ? JSON.parse(notice.evidenceReferenceIds).length
                        : 0}
                    </small>
                  </div>
                ))
              ) : (
                <span>لم يتم إنشاء Notices لهذا المشروع بعد.</span>
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
      <section className="workflow-panel">
        <div className="workflow-heading">
          <div>
            <p className="eyebrow">ELECTRONIC CLAIM REVIEW</p>
            <h2>مسار الاعتماد الإلكتروني</h2>
            <p>
              مسودة ← مراجعة التخطيط ← مراجعة العقود ← اعتماد مدير المطالبات ←
              جاهزة للتصدير. لا يجيز النظام قرار المرحلة إلا للمراجع المعيّن
              لها.
            </p>
          </div>
          <ClipboardCheck size={23} />
        </div>
        {!isAuthenticated ? (
          <div className="workflow-login">
            <LogIn size={18} />
            <span>سجّل الدخول لإنشاء مسار المراجعة وحفظ قراراته.</span>
            <Button className="run-button" onClick={startLogin}>
              تسجيل الدخول
            </Button>
          </div>
        ) : !current ? (
          <div className="workflow-empty">
            <p>لا يوجد مسار اعتماد لهذه المطالبة بعد.</p>
            <Button
              className="run-button"
              disabled={startReview.isPending}
              onClick={() =>
                startReview.mutate({
                  projectKey: schedule.id,
                  claimKey,
                  claimTitle: `${schedule.name} — مطالبة TIA`,
                })
              }
            >
              <CheckCircle2 size={16} />
              إنشاء مسار الاعتماد
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
                  <span>{reviewLabels[stage]}</span>
                </div>
              ))}
            </div>
            <div className="review-status">
              <b>الحالة: {reviewLabels[current.status] ?? current.status}</b>
              <span>
                المرحلة الحالية:{" "}
                {reviewLabels[current.currentStage] ?? current.currentStage}
              </span>
            </div>
            {review.data?.isOwner ? (
              <div className="review-assignments">
                <h3>تعيين مراجعي المراحل</h3>
                <p>
                  أضف الأعضاء من لوحة «أعضاء المشروع» ثم اختر الاسم المناسب لكل
                  مرحلة. يسجل النظام الإسناد في سجل التدقيق.
                </p>
                {participantStages.map(stage => (
                  <div key={stage}>
                    <Label>{reviewLabels[stage]}</Label>
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
                        <SelectValue placeholder="اختر عضواً" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">اختر عضواً</SelectItem>
                        {projectMembers.data?.map(member => (
                          <SelectItem
                            key={member.memberUserId}
                            value={String(member.memberUserId)}
                          >
                            {member.name} —{" "}
                            {member.isOwner
                              ? "مالك المشروع"
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
                      حفظ المراجع
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="workflow-subtle">
                يخضع قرارك لصلاحية التعيين المسجلة لهذه المرحلة.
              </p>
            )}
            {current.currentStage !== "ready_to_export" ? (
              <>
                <Label>تعليق القرار (اختياري)</Label>
                <Textarea
                  rows={2}
                  value={reviewComment}
                  onChange={event => setReviewComment(event.target.value)}
                  placeholder="سبب القرار أو ملاحظة المراجع…"
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
                        ? "إحالة إلى التخطيط"
                        : action === "reopened"
                          ? "إعادة فتح المسار"
                          : "اعتماد والانتقال للمرحلة التالية"}
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
                          "تمت إضافة ملاحظة دون تغيير المرحلة.",
                      })
                    }
                  >
                    تسجيل تعليق
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        reviewId: current.id,
                        decision: "rejected",
                        comment: reviewComment || "تم رفض المراجعة.",
                      })
                    }
                  >
                    رفض
                  </Button>
                </div>
              </>
            ) : (
              <div className="workflow-ready">
                <CheckCircle2 size={20} />
                <span>
                  المطالبة جاهزة للتصدير. ستظهر حالة الاعتماد في التقرير عند
                  التصدير.
                </span>
              </div>
            )}
            <div className="audit-log">
              <h3>سجل التدقيق غير القابل للتحرير</h3>
              {audit.map(entry => (
                <div key={entry.id}>
                  <b>{reviewLabels[entry.decision] ?? entry.decision}</b>
                  <span>
                    {reviewLabels[entry.stage] ?? entry.stage} ·{" "}
                    {entry.reviewerName || entry.reviewerEmail || "مستخدم"} ·{" "}
                    {dateText(entry.recordedAt)}
                  </span>
                  <small>{entry.comment || "دون تعليق"}</small>
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
