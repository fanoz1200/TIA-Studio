import React, { useMemo, useRef, useState } from "react";
import {
  CircleHelp,
  Download,
  FileCheck2,
  FileCode2,
  FileText,
  FolderTree,
  LoaderCircle,
  LogIn,
  Paperclip,
  Upload,
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
import { trpc } from "@/lib/trpc";
import { importP6XmlSchedule, type P6XmlImportSummary } from "@/lib/p6-xml";
import {
  calculateFinancialImpact,
  getFragnetDelayDuration,
  resourceAssignmentsForEvent,
  runCPM,
  type Fragnet,
  type Schedule,
  type TiaResult,
  type WindowTiaResult,
} from "@/lib/cpm";
import {
  exportClaimDocx,
  exportFullClaimFactPack,
  exportClaimPdf,
  type ClaimReportPayload,
  type ClaimTemplateDraft,
} from "@/lib/claim-export";
import { exportAnalysisExcel } from "@/lib/analysis-excel";
import type { DocumentLanguage } from "@/lib/language";
import { ScheduleComparisonPanel } from "@/components/ScheduleComparisonPanel";
import {
  evaluateWorkflowReadiness,
  workflowReadinessSummary,
  type WorkflowCheckState,
} from "@/lib/workflow-validation";
import { evaluateTiaResultQuality } from "@/lib/tia-result-validation";
import { assessScheduleQuality } from "@/lib/schedule-quality";
import { TiaResultValidationPanel } from "@/components/TiaResultValidationPanel";
import {
  buildP6ReconciliationManifest,
  serializeP6ReconciliationManifest,
} from "@/lib/p6-reconciliation-manifest";

type View =
  | "guided"
  | "schedule"
  | "quality"
  | "event"
  | "analysis"
  | "report"
  | "overview"
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
type EvidenceType =
  | "correspondence"
  | "instruction"
  | "drawing"
  | "programme"
  | "photo"
  | "report"
  | "other";

const initialTemplate: ClaimTemplateDraft = {
  title: "إشعار مطالبة بتمديد مدة",
  recipient: "المهندس / ممثل صاحب العمل",
  contractReference: "مرجع العقد: يحدد عند الإصدار",
  introduction:
    "إشارة إلى برنامج العمل المعتمد وإلى وقائع أحداث التأخير المبينة أدناه، يقدم المقاول هذا الإشعار الفني لدعم مراجعة الأثر الزمني.",
  entitlementPosition:
    "يُطلب تقييم الاستحقاق وفق العقد والإشعارات والأدلة. التحليل الزمني يدعم تقييم الأثر ولا يحل محل الرأي القانوني أو قرار الجهة المخولة.",
  reliefRequested:
    "يُطلب اعتماد تمديد للمدة بما يعادل الأثر الزمني المحدد في التحليل، مع حفظ الحقوق التعاقدية ذات الصلة.",
  closing:
    "يرجى دراسة المستند والمرفقات وإصدار القرار وفق الإجراءات التعاقدية المعتمدة.",
};

function fileBase64(file: File, readErrorMessage: string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(readErrorMessage));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function sourceLabel(source?: Schedule["source"]) {
  return source === "p6-xml"
    ? "P6 XML"
    : source === "xer"
      ? "P6 XER"
      : source?.toUpperCase() || "MANUAL";
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
  const { language: interfaceLanguage, direction } = useAppLanguage();
  const txt = (ar: string, en: string) =>
    interfaceLanguage === "en" ? en : ar;
  const xmlInput = useRef<HTMLInputElement>(null);
  const evidenceInput = useRef<HTMLInputElement>(null);
  const [xmlSummary, setXmlSummary] = useState<P6XmlImportSummary | null>(null);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] =
    useState<EvidenceType>("correspondence");
  const [evidenceDate, setEvidenceDate] = useState("");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [template, setTemplate] = useState<ClaimTemplateDraft>(initialTemplate);
  const [documentLanguage, setDocumentLanguage] = useState<DocumentLanguage>(() =>
    window.localStorage.getItem("tia-studio-document-language") === "en" ? "en" : "ar"
  );
  const [isImporting, setIsImporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"docx" | "pdf" | null>(
    null
  );
  const [analystExpectedDays, setAnalystExpectedDays] = useState("");
  const evidence = trpc.evidence.list.useQuery(
    { projectKey: schedule.id, eventKey: selectedEvent?.id ?? "none" },
    {
      enabled:
        Boolean(selectedEvent) &&
        isAuthenticated &&
        (view === "event" || view === "analysis" || view === "report"),
    }
  );
  const templates = trpc.claimTemplate.list.useQuery(undefined, {
    enabled: isAuthenticated && view === "report",
  });
  const claimKey = useMemo(
    () => activeClaimKey || `${schedule.id}:delay-claim`,
    [activeClaimKey, schedule.id]
  );
  const notices = trpc.notice.list.useQuery(
    { projectKey: schedule.id, claimKey },
    { enabled: isAuthenticated && view === "report" }
  );
  const review = trpc.claimReview.get.useQuery(
    { projectKey: schedule.id, claimKey },
    { enabled: isAuthenticated && view === "report" }
  );
  const upload = trpc.evidence.upload.useMutation({
    onSuccess: () => {
      evidence.refetch();
      toast.success(txt("تم حفظ الدليل وربطه بالحدث المحدد.", "Evidence saved and linked to the selected event."));
      setEvidenceTitle("");
      setEvidenceDescription("");
      setEvidenceDate("");
    },
  });
  const remove = trpc.evidence.remove.useMutation({
    onSuccess: () => evidence.refetch(),
  });
  const saveTemplate = trpc.claimTemplate.create.useMutation({
    onSuccess: () => {
      templates.refetch();
      toast.success(txt("تم حفظ قالب المطالبة ضمن حسابك.", "Claim template was saved to your account."));
    },
  });
  const workflowChecks = useMemo(
    () =>
      evaluateWorkflowReadiness({
        schedule,
        selectedEvent,
        analysis: activeResult,
        evidenceCount: evidence.data?.length ?? 0,
        noticeCount: notices.data?.length ?? 0,
        reviewStatus: review.data?.review.status,
        isAuthenticated,
        hasEventResources:
          resourceAssignmentsForEvent(schedule, selectedEvent).length > 0,
          templateReady: Boolean(
            template.title.trim() &&
            template.recipient.trim() &&
            template.contractReference.trim()
          ),
      }, interfaceLanguage),
    [
      activeResult,
      evidence.data?.length,
      isAuthenticated,
      notices.data?.length,
      review.data?.review.status,
      schedule,
      selectedEvent,
      interfaceLanguage,
      template.contractReference,
      template.recipient,
      template.title,
    ]
  );
  const resultQuality = useMemo(
    () =>
      evaluateTiaResultQuality({
        schedule,
        selectedEvent,
        analysis: activeResult,
      }),
    [activeResult, schedule, selectedEvent]
  );
  const scheduleQuality = useMemo(
    () => assessScheduleQuality(schedule),
    [schedule]
  );
  const exportBlocked =
    workflowChecks.some(check => check.state === "blocked") ||
    resultQuality.state === "rejected";

  async function importXml(file: File) {
    setIsImporting(true);
    try {
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => resolve())
      );
      const result = importP6XmlSchedule(await file.text(), file.name);
      setXmlSummary(result.summary);
      onScheduleImported(result.schedule, result.summary);
      toast.success(
        txt(
          `تم استيراد P6 XML: ${result.summary.activitiesRead} نشاط، ${result.summary.wbsRead} عنصر WBS، و${result.summary.activitiesWithProgress} نسبة إنجاز.`,
          `P6 XML imported: ${result.summary.activitiesRead} activities, ${result.summary.wbsRead} WBS items, and ${result.summary.activitiesWithProgress} progress values.`
        )
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : txt("تعذر قراءة ملف P6 XML.", "Unable to read the P6 XML file.")
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function uploadEvidence(file: File) {
    if (!selectedEvent) {
      toast.error(txt("اختر أو أنشئ حدث تأخير أولاً لربط الدليل به.", "Create or select a delay event first to link the evidence."));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(txt("الحد الأقصى للمرفق هو 10 MB.", "The attachment limit is 10 MB."));
      return;
    }
    try {
      await upload.mutateAsync({
        projectKey: schedule.id,
        eventKey: selectedEvent.id,
        title: evidenceTitle.trim() || file.name,
        description: evidenceDescription.trim() || undefined,
        evidenceType,
        receivedAt: evidenceDate || undefined,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBase64: await fileBase64(file, txt("تعذر قراءة المرفق.", "Unable to read the attachment.")),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : txt("تعذر حفظ المرفق.", "Unable to save the attachment."));
    }
  }

  function payload(): ClaimReportPayload | null {
    if (!activeResult) {
      toast.error(txt("شغّل تحليل TIA أولاً لتوليد تقرير المطالبة.", "Run TIA analysis first to generate the claim report."));
      return null;
    }
    const impactDays =
      "totalImpactDays" in activeResult
        ? activeResult.totalImpactDays
        : activeResult.impactDays;
    const currentEvidence = (evidence.data ?? []).map(item => ({
      title: item.title,
      fileName: item.fileName,
      evidenceType: item.evidenceType,
      description: item.description,
      receivedAt: item.receivedAt,
    }));
    const eventResources = resourceAssignmentsForEvent(schedule, selectedEvent);
    const financial = calculateFinancialImpact(
      Math.max(0, impactDays),
      eventResources,
      schedule.calendar?.hoursPerDay ?? 8
    );
    const financialImpact = eventResources.length
      ? {
          dailyCost: financial.dailyCost,
          extensionCost: financial.extensionCost,
          byResourceType: Object.entries(financial.byResourceType).map(
            ([type, bucket]) => ({
              label:
                documentLanguage === "en"
                  ? type === "labor"
                    ? "Labour"
                    : type === "nonlabor"
                      ? "Plant / non-labour"
                      : type === "material"
                        ? "Materials"
                        : "Unclassified"
                  : type === "labor"
                    ? "عمالة"
                    : type === "nonlabor"
                      ? "معدات / غير عمالة"
                      : type === "material"
                        ? "مواد"
                        : "غير مصنف",
              dailyCost: bucket.dailyCost,
              extensionCost: bucket.extensionCost,
            })
          ),
          warnings: financial.warnings,
        }
      : undefined;
    return {
      language: documentLanguage,
      projectName: schedule.name,
      scheduleSource: sourceLabel(schedule.source),
      baselineFinish: activeResult.baseline.completionDate,
      impactedFinish: activeResult.impacted.completionDate,
      impactDays,
      methodology: "Time Impact Analysis (CPM/Fragnet) — TIA Studio",
      narrative,
      template,
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        occurrenceDate: event.occurrenceDate,
        duration: getFragnetDelayDuration(event),
        cause: event.cause,
      })),
      evidence: currentEvidence,
      financialImpact,
      notices: notices.data?.map(item => ({
        noticeNo: item.noticeNo,
        eventKey: item.eventKey,
        status: item.computedStatus,
        narrative: item.narrative,
        timeImpactDays: Number(item.timeImpactDays),
        costImpact: Number(item.costImpact),
        noticeDueDate: item.noticeDueDate,
      })),
      review: review.data
        ? {
            currentStage: review.data.review.currentStage,
            status: review.data.review.status,
            auditCount: review.data.audit.length,
            participants: review.data.participants.map(item => ({
              stage: item.stage,
              reviewerId: item.reviewerId,
            })),
          }
        : null,
      scheduleQuality,
      resultSources:
        documentLanguage === "en"
          ? [
              `Schedule source: ${sourceLabel(schedule.source)} — ${schedule.activities.length} activities and ${schedule.relationships.length} relationships at report generation.`,
              `Calculation engine: local CPM followed by TIA/Fragnet; displayed impact is ${impactDays} working days.`,
              "Quality gate: an explainable internal structural check; it does not replace opening the file in Primavera or professional review.",
            ]
          : [
              `مصدر البرنامج: ${sourceLabel(schedule.source)} — ${schedule.activities.length} نشاط و${schedule.relationships.length} علاقة عند إنشاء التقرير.`,
              `محرك الحساب: CPM محلي ثم TIA/Fragnet؛ الأثر الظاهر ${impactDays} يوم عمل.`,
              "بوابة الجودة: فحص بنيوي داخلي قابل للتفسير، ولا يحل محل إعادة الفتح في Primavera أو المراجعة المهنية.",
            ],
      generatedAt: new Date().toISOString(),
    };
  }

  async function exportReport(format: "docx" | "pdf") {
    if (exportBlocked) {
      toast.error(
        txt(
          "التصدير متوقف: عالج الموانع في قائمة التحقق ونتيجة TIA أولاً.",
          "Export is blocked: resolve the blockers in the checklist and TIA result first."
        )
      );
      return;
    }
    const output = payload();
    if (!output) return;
    setExportingFormat(format);
    try {
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => resolve())
      );
      if (format === "docx") await exportClaimDocx(output);
      else await exportClaimPdf(output);
      toast.success(
        format === "docx"
          ? txt("تم إنشاء ملف Word.", "Word file created.")
          : txt("تم إنشاء ملف PDF.", "PDF file created.")
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : format === "docx"
            ? txt("تعذر إنشاء Word.", "Unable to create the Word file.")
            : txt("تعذر إنشاء PDF.", "Unable to create the PDF file.")
      );
    } finally {
      setExportingFormat(null);
    }
  }

  function exportWorkbook() {
    if (exportBlocked || !activeResult) {
      toast.error(txt("التصدير متوقف: عالج الموانع وشغّل تحليل TIA أولاً.", "Export is blocked: resolve the blockers and run TIA analysis first."));
      return;
    }
    exportAnalysisExcel({
      schedule,
      quality: scheduleQuality,
      analysis: activeResult,
      events,
      narrative,
      language: documentLanguage,
    });
    toast.success(txt("تم إنشاء التقرير النهائي Excel متعدد الأوراق.", "Multi-sheet Excel final report created."));
  }

  function exportFactPack() {
    const output = payload();
    if (!output) return;
    exportFullClaimFactPack(output);
    toast.success(
      txt(
        "تم تنزيل Fact Pack منظم محلياً؛ لا يتضمن مستندات خاماً أو استحقاقاً غير موثق.",
        "A local Fact Pack was downloaded; it does not include raw documents or an unsupported entitlement."
      )
    );
  }

  function exportReconciliationManifest() {
    if (!activeResult || !("impactDays" in activeResult)) {
      toast.error(
        txt(
          "ملف المطابقة يحتاج نتيجة TIA واحدة بحدث Fragnet؛ تحليل النوافذ يظل له تقريره المنفصل.",
          "The reconciliation manifest requires a single-event TIA result with a Fragnet; window analysis retains its separate report."
        )
      );
      return;
    }
    try {
      const manifest = buildP6ReconciliationManifest({
        schedule,
        cpm: runCPM(schedule),
        tia: activeResult,
      });
      const url = URL.createObjectURL(
        new Blob([serializeP6ReconciliationManifest(manifest)], {
          type: "application/json;charset=utf-8",
        })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `TIA-Studio-P6-Reconciliation-${schedule.id}-${activeResult.fragnetId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(
        txt(
          "تم تصدير ملف المطابقة المحلي. قارنه مع P6 أو مدقق مستقل قبل وصف النتائج بأنها متطابقة.",
          "Local reconciliation manifest exported. Compare it with P6 or an independent checker before describing results as matching."
        )
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : txt("تعذر إنشاء ملف المطابقة المحلي.", "Unable to create the local reconciliation manifest.")
      );
    }
  }

  if (view === "compare")
    return (
      <ScheduleComparisonPanel
        currentSchedule={schedule}
        selectedEvent={selectedEvent}
      />
    );
  if (view === "analysis")
    return (
      <TiaResultValidationPanel
        schedule={schedule}
        selectedEvent={selectedEvent}
        activeResult={activeResult}
        analystExpectedDays={analystExpectedDays}
        onAnalystExpectedDaysChange={setAnalystExpectedDays}
      />
    );
  if (view === "schedule")
    return (
      <section className="p6-ops-panel" dir={direction}>
        <div className="p6-ops-copy">
          <p className="eyebrow">P6 EXTENDED IMPORT</p>
          <h2>{txt("بيانات التقدم وWBS من Primavera", "Progress data and WBS from Primavera")}</h2>
          <p>{txt(
            "يدعم المستورد P6 XML عناصر Project وActivity وRelationship وWBS، ويعرض النسب كما وردت دون تحويلها إلى حكم استحقاق.",
            "The P6 XML importer supports Project, Activity, Relationship and WBS records and displays progress as received without turning it into an entitlement finding."
          )}</p>
          <p className="context-tip">
            <CircleHelp size={15} />
            {txt("ابدأ بنسخة برنامج معتمدة، ثم راجع أعداد الأنشطة والعلاقات وWBS المعروضة بعد الاستيراد قبل تشغيل TIA.", "Start from an approved programme, then review the displayed activity, relationship and WBS counts before running TIA.")}
          </p>
        </div>
        <div className="p6-ops-actions">
          <Button
            variant="outline"
            className="outline-action"
            disabled={isImporting}
            title={txt("تُقرأ البيانات محلياً في المتصفح؛ لا يُرفع ملف P6 إلى خدمة تحليل خارجية.", "The data is read locally in the browser; no P6 file is uploaded to an external analysis service.")}
            onClick={() => xmlInput.current?.click()}
          >
            {isImporting ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <FileCode2 size={16} />
            )}
            {isImporting ? txt("جارِ قراءة الملف…", "Reading file…") : txt("استيراد P6 XML", "Import P6 XML")}
          </Button>
          <input
            ref={xmlInput}
            hidden
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) importXml(file);
              event.currentTarget.value = "";
            }}
          />
          {isImporting ? (
            <div className="operation-progress" role="status">
              <span />
              {txt("يُفكك الهيكل والعلاقات وبيانات الموارد…", "Parsing structure, relationships and resource data…")}
            </div>
          ) : null}
          <div className="p6-stat">
            <FolderTree size={18} />
            <span>
              <b>{schedule.wbsNodes?.length ?? 0}</b> {txt("عناصر WBS", "WBS items")}
            </span>
          </div>
          <div className="p6-stat">
            <FileCheck2 size={18} />
            <span>
              <b>
                {
                  schedule.activities.filter(
                    activity => activity.percentComplete !== undefined
                  ).length
                }
              </b>{" "}
              {txt("نسب إنجاز", "progress values")}
            </span>
          </div>
        </div>
        {xmlSummary ? (
          <div className="p6-summary">
            <b>{txt("آخر استيراد XML", "Latest XML import")}: {xmlSummary.projectName}</b>
            <span>
              {xmlSummary.activitiesRead} {txt("نشاط", "activities")} · {xmlSummary.relationshipsRead}{" "}
              {txt("علاقة", "relationships")} · {xmlSummary.wbsRead} WBS ·{" "}
              {xmlSummary.activitiesWithProgress} {txt("نسبة إنجاز", "progress values")}
            </span>
          </div>
        ) : null}
      </section>
    );

  if (view === "event")
    return (
      <section className="evidence-panel" dir={direction}>
        <div className="evidence-header">
          <div>
            <p className="eyebrow">EVIDENCE REGISTER</p>
            <h2>{txt("أدلة حدث التأخير", "Delay-event evidence")}</h2>
            <p>
              {selectedEvent
                ? `${txt("ربط الوثائق بالحدث", "Link documents to event")} ${selectedEvent.id}: ${selectedEvent.title}`
                : txt("اختر حدثاً من سجل التحليل لربط الأدلة به.", "Select an event from the analysis register to link its evidence.")}
            </p>
          </div>
          <Paperclip size={22} />
        </div>
        {!isAuthenticated ? (
          <div className="evidence-login">
            <LogIn size={18} />
            <div>
              <b>{txt("يلزم تسجيل الدخول لحفظ الأدلة", "Sign in to save evidence")}</b>
              <p>{txt("تُحفظ المرفقات المرتبطة بالأحداث في مساحة خاصة بحسابك، ولا يبدأ أي رفع قبل تسجيل الدخول.", "Event attachments are saved in a private account workspace; no upload begins before sign-in.")}</p>
            </div>
            <Button className="run-button" onClick={startLogin}>
              {txt("تسجيل الدخول", "Sign in")}
            </Button>
          </div>
        ) : selectedEvent ? (
          <>
            <div className="evidence-form">
              <div>
                <Label>{txt("عنوان الدليل", "Evidence title")}</Label>
                <Input
                  value={evidenceTitle}
                  onChange={event => setEvidenceTitle(event.target.value)}
                  placeholder={txt("مثال: خطاب اعتماد الرسومات", "Example: drawing approval letter")}
                />
              </div>
              <div>
                <Label>{txt("نوع الدليل", "Evidence type")}</Label>
                <Select
                  value={evidenceType}
                  onValueChange={value =>
                    setEvidenceType(value as EvidenceType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correspondence">{txt("مراسلة", "Correspondence")}</SelectItem>
                    <SelectItem value="instruction">{txt("تعليمات", "Instruction")}</SelectItem>
                    <SelectItem value="drawing">{txt("رسومات", "Drawing")}</SelectItem>
                    <SelectItem value="programme">{txt("برنامج", "Programme")}</SelectItem>
                    <SelectItem value="photo">{txt("صورة", "Photo")}</SelectItem>
                    <SelectItem value="report">{txt("تقرير", "Report")}</SelectItem>
                    <SelectItem value="other">{txt("آخر", "Other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{txt("تاريخ الاستلام", "Date received")}</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={evidenceDate}
                  onChange={event => setEvidenceDate(event.target.value)}
                />
              </div>
              <div className="evidence-form-wide">
                <Label>{txt("وصف وسبب الصلة بالحدث", "Description and relevance to the event")}</Label>
                <Textarea
                  rows={2}
                  value={evidenceDescription}
                  onChange={event => setEvidenceDescription(event.target.value)}
                />
              </div>
            </div>
            <div className="evidence-upload-row">
              <p>
                {txt("تحفظ الملفات في مساحة مرفقات آمنة مرتبطة بحسابك. الحد الأقصى للملف 10 MB.", "Files are stored in a secure attachment space linked to your account. Maximum file size: 10 MB.")}
              </p>
              <Button
                className="run-button"
                disabled={upload.isPending}
                onClick={() => evidenceInput.current?.click()}
              >
                <Upload size={16} />
                {txt("إرفاق مستند", "Attach document")}
              </Button>
              <input
                ref={evidenceInput}
                type="file"
                hidden
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff,.msg,.eml,.txt"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) uploadEvidence(file);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <div className="evidence-list">
              {evidence.isLoading ? (
                <span>{txt("جار تحميل سجل الأدلة…", "Loading evidence register…")}</span>
              ) : evidence.data?.length ? (
                evidence.data.map(item => (
                  <div className="evidence-row" key={item.id}>
                    <FileText size={17} />
                    <div>
                      <b>{item.title}</b>
                      <span>
                        {item.fileName} · {item.evidenceType} ·{" "}
                        {item.sizeBytes.toLocaleString()} bytes
                      </span>
                      {item.description ? (
                        <small>{item.description}</small>
                      ) : null}
                    </div>
                    <a href={item.storageUrl} target="_blank" rel="noreferrer">
                      {txt("فتح", "Open")}
                    </a>
                    <button onClick={() => remove.mutate({ id: item.id })}>
                      {txt("حذف", "Delete")}
                    </button>
                  </div>
                ))
              ) : (
                <span>{txt("لا توجد مستندات مربوطة بهذا الحدث بعد.", "No documents are linked to this event yet.")}</span>
              )}
            </div>
          </>
        ) : null}
      </section>
    );

  if (view === "report")
    return (
      <section className="claim-export-panel" dir={direction}>
        <div className="claim-export-header">
          <div>
            <p className="eyebrow">CLAIM OUTPUT</p>
            <h2>{txt("قالب المطالبة وتصدير التقرير", "Claim template and report export")}</h2>
            <p>{txt("حرّر القالب ثم صدّر Full Claim ثابتاً بصيغة Word أو PDF أو التقرير النهائي Excel متعدد الأوراق، أو Fact Pack محلي JSON. يُدرج التقرير السرد ونتائج TIA وسجل الأحداث وأدلة الحدث المحدد، ويظهر أي نقص بوضوح.", "Edit the template, then export a fixed Full Claim in Word or PDF, a multi-sheet Excel final report, or a local JSON Fact Pack. The report includes the narrative, TIA results, event register and selected-event evidence, and clearly shows any gap.")}</p>
            <p className="context-tip">
              <CircleHelp size={15} />
              {txt("ملف المطابقة ليس بديلاً عن Primavera: شغّل TIA أولاً، ثم قارنه مع P6 أو مدقق مستقل قبل وصف النتائج بأنها متطابقة.", "The reconciliation file is not a substitute for Primavera: run TIA first, then compare it with P6 or an independent checker before describing results as equivalent.")}
            </p>
          </div>
          <FileText size={22} />
        </div>
        <WorkflowQualityGate checks={workflowChecks} language={interfaceLanguage} />
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <Label htmlFor="document-language" className="font-semibold">
            {txt("لغة المخرجات", "Output language")}
          </Label>
          <Select
            value={documentLanguage}
            onValueChange={(value: DocumentLanguage) => {
              setDocumentLanguage(value);
              window.localStorage.setItem("tia-studio-document-language", value);
            }}
          >
            <SelectTrigger id="document-language" className="w-52 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">العربية — RTL</SelectItem>
              <SelectItem value="en">English — LTR</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {txt("ينطبق الاختيار على Word وPDF وExcel وFact Pack. البيانات التي كتبتها تظل كما سجلتها.", "The choice applies to Word, PDF, Excel and Fact Pack. The data you entered remains exactly as recorded.")}
          </p>
        </div>
        <div className="claim-template-grid">
          <div>
            <Label>{txt("اسم القالب", "Template name")}</Label>
            <Input
              value={template.title}
              onChange={event =>
                setTemplate({ ...template, title: event.target.value })
              }
            />
          </div>
          <div>
            <Label>{txt("المخاطب", "Recipient")}</Label>
            <Input
              value={template.recipient}
              onChange={event =>
                setTemplate({ ...template, recipient: event.target.value })
              }
            />
          </div>
          <div className="claim-template-wide">
            <Label>{txt("مرجع العقد", "Contract reference")}</Label>
            <Input
              value={template.contractReference}
              onChange={event =>
                setTemplate({
                  ...template,
                  contractReference: event.target.value,
                })
              }
            />
          </div>
          <div className="claim-template-wide">
            <Label>{txt("التمهيد", "Introduction")}</Label>
            <Textarea
              rows={3}
              value={template.introduction}
              onChange={event =>
                setTemplate({ ...template, introduction: event.target.value })
              }
            />
          </div>
          <div className="claim-template-wide">
            <Label>{txt("الموقف التعاقدي", "Contract position")}</Label>
            <Textarea
              rows={3}
              value={template.entitlementPosition}
              onChange={event =>
                setTemplate({
                  ...template,
                  entitlementPosition: event.target.value,
                })
              }
            />
          </div>
          <div className="claim-template-wide">
            <Label>{txt("التمديد/الإغاثة المطلوبة", "Extension / relief requested")}</Label>
            <Textarea
              rows={3}
              value={template.reliefRequested}
              onChange={event =>
                setTemplate({
                  ...template,
                  reliefRequested: event.target.value,
                })
              }
            />
          </div>
          <div className="claim-template-wide">
            <Label>{txt("الخاتمة", "Closing")}</Label>
            <Textarea
              rows={2}
              value={template.closing}
              onChange={event =>
                setTemplate({ ...template, closing: event.target.value })
              }
            />
          </div>
        </div>
        <div className="claim-export-actions">
          {isAuthenticated ? (
            <Button
              variant="outline"
              onClick={() => saveTemplate.mutate({ ...template })}
              disabled={saveTemplate.isPending}
            >
              <FileCheck2 size={16} />
              {txt("حفظ القالب", "Save template")}
            </Button>
          ) : (
            <Button variant="outline" onClick={startLogin}>
              <LogIn size={18} />
              {txt("تسجيل الدخول لحفظ القالب", "Sign in to save template")}
            </Button>
          )}
          <Button
            variant="outline"
            title={
              activeResult && "impactDays" in activeResult
                ? txt("ينشئ ملف JSON محلياً للمقارنة مع P6 أو مدقق مستقل؛ لا يثبت التكافؤ تلقائياً.", "Creates a local JSON file for comparison with P6 or an independent checker; it does not prove equivalence automatically.")
                : txt("يتاح بعد تشغيل TIA لحدث Fragnet واحد؛ تحليل النوافذ له تقرير منفصل.", "Available after running TIA for one Fragnet event; window analysis has a separate report.")
            }
            disabled={!activeResult || !("impactDays" in activeResult)}
            onClick={exportReconciliationManifest}
          >
            <FileCheck2 size={16} />
            {txt("ملف مطابقة P6 (JSON)", "P6 reconciliation file (JSON)")}
          </Button>
          <Button
            variant="outline"
            title={
              exportBlocked
                ? txt("عالج الموانع في قائمة التحقق قبل التصدير.", "Resolve the blockers in the checklist before export.")
                : txt("ينشئ التقرير النهائي متعدد الأوراق بصيغة Excel من بيانات TIA الحالية.", "Creates a multi-sheet Excel final report from the current TIA data.")
            }
            disabled={exportingFormat !== null || exportBlocked}
            onClick={exportWorkbook}
          >
            <Download size={16} />
            {txt("تصدير التقرير النهائي Excel", "Export Excel final report")}
          </Button>
          <Button
            variant="outline"
            title={txt("ينزّل Fact Pack منظم من بيانات التحليل الحالية للمراجعة أو التوسعة الموثقة، من دون ملفات العميل الخام.", "Downloads a structured Fact Pack from the current analysis data for review or documented extension, without raw client files.")}
            disabled={exportingFormat !== null || !activeResult}
            onClick={exportFactPack}
          >
            <FileCode2 size={16} />
            {txt("تنزيل Fact Pack (JSON)", "Download Fact Pack (JSON)")}
          </Button>
          <Button
            variant="outline"
            title={
              exportBlocked
                ? txt("عالج الموانع في قائمة التحقق قبل التصدير.", "Resolve the blockers in the checklist before export.")
                : txt("ينشئ Full Claim قابلاً للتحرير بغلاف وفهرس وسجل أدلة ونواقص معلنة.", "Creates an editable Full Claim with a cover, table of contents, evidence register and disclosed gaps.")
            }
            disabled={exportingFormat !== null || exportBlocked}
            onClick={() => exportReport("docx")}
          >
            {exportingFormat === "docx" ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            {exportingFormat === "docx"
              ? txt("جارِ تجهيز Full Claim…", "Preparing Full Claim…")
              : txt("تصدير Full Claim (Word)", "Export Full Claim (Word)")}
          </Button>
          <Button
            className="run-button"
            title={
              exportBlocked
                ? txt("عالج الموانع في قائمة التحقق قبل التصدير.", "Resolve the blockers in the checklist before export.")
                : txt("ينشئ نسخة PDF عربية من بيانات المطالبة الحالية.", "Creates a PDF version from the current claim data.")
            }
            disabled={exportingFormat !== null || exportBlocked}
            onClick={() => exportReport("pdf")}
          >
            {exportingFormat === "pdf" ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            {exportingFormat === "pdf"
              ? txt("جارِ تجهيز PDF…", "Preparing PDF…")
              : txt("تصدير PDF", "Export PDF")}
          </Button>
        </div>
        {exportingFormat ? (
          <div className="operation-progress" role="status">
            <span />
            {txt("يتم تجميع السرد والجداول وسجل الأدلة ومراحل الاعتماد…", "Compiling the narrative, tables, evidence register and approval stages…")}
          </div>
        ) : null}
        {templates.data?.length ? (
          <div className="saved-templates">
            {txt("قوالب محفوظة:", "Saved templates:")}{" "}
            {templates.data.map(item => (
              <button
                key={item.id}
                onClick={() =>
                  setTemplate({
                    title: item.title,
                    recipient: item.recipient ?? "",
                    contractReference: item.contractReference ?? "",
                    introduction: item.introduction ?? "",
                    entitlementPosition: item.entitlementPosition ?? "",
                    reliefRequested: item.reliefRequested ?? "",
                    closing: item.closing ?? "",
                  })
                }
              >
                {item.title}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    );
  return null;
}

function WorkflowQualityGate({
  checks,
  language,
}: {
  checks: ReturnType<typeof evaluateWorkflowReadiness>;
  language: "ar" | "en";
}) {
  const txt = (ar: string, en: string) => (language === "en" ? en : ar);
  const iconFor = (state: WorkflowCheckState) =>
    state === "pass"
      ? "✓"
      : state === "blocked"
        ? "×"
        : state === "attention"
          ? "!"
          : "i";
  return (
    <section className="workflow-quality-gate" aria-label={txt("قائمة تحقق المطالبة", "Claim checklist")}>
      <header>
        <div>
          <p className="eyebrow">{txt("بوابة جودة سير العمل", "WORKFLOW QUALITY GATE")}</p>
          <h3>{txt("قائمة تحقق قبل التصدير", "Pre-export checklist")}</h3>
        </div>
        <span className="workflow-quality-summary">
          {workflowReadinessSummary(checks, language)}
        </span>
      </header>
      <div className="workflow-check-grid">
        {checks.map(check => (
          <article
            key={check.id}
            className={`workflow-check workflow-check-${check.state}`}
          >
            <b aria-hidden="true">{iconFor(check.state)}</b>
            <div>
              <h4>{check.title}</h4>
              <p>{check.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
