import type { Fragnet, Schedule, TiaResult, WindowTiaResult } from "./cpm";
import type { AppLanguage } from "./language";
import { assessScheduleQuality } from "./schedule-quality";
import { evaluateTiaResultQuality } from "./tia-result-validation";

export type WorkflowCheckState = "pass" | "attention" | "blocked" | "info";

export type ClaimReviewDisclosureId =
  | "cause-basis"
  | "change-authority"
  | "mitigation"
  | "concurrency"
  | "quantum";

export type ClaimReviewDisclosures = Record<ClaimReviewDisclosureId, boolean>;

export const claimReviewDisclosureDefinitions: Array<{
  id: ClaimReviewDisclosureId;
  title: { ar: string; en: string };
  detail: { ar: string; en: string };
}> = [
  {
    id: "cause-basis",
    title: { ar: "أساس السبب والوقائع", en: "Cause and factual basis" },
    detail: { ar: "راجع أن التسلسل الزمني والوثائق يبيّنان الوقائع، لا مجرد وجود تأخير.", en: "Confirm that the chronology and documents establish facts, not merely that delay occurred." },
  },
  {
    id: "change-authority",
    title: { ar: "تفويض التغيير", en: "Change authority" },
    detail: { ar: "راجع وجود تعليمات أو مراسلات أو أساس تعاقدي قبل وصف التغيير في المطالبة.", en: "Review instructions, correspondence or contractual basis before describing a change in the claim." },
  },
  {
    id: "mitigation",
    title: { ar: "التخفيف والسجل المعاصر", en: "Mitigation and contemporaneous record" },
    detail: { ar: "سجّل ما جُرّب للتخفيف وما إذا كانت مستندات الفترة المعاصرة متاحة للمراجع.", en: "Record mitigation steps and whether contemporaneous records are available to the reviewer." },
  },
  {
    id: "concurrency",
    title: { ar: "إفصاح التزامن", en: "Concurrency disclosure" },
    detail: { ar: "افحص احتمال تزامن أسباب مستقلة ولا تحوّل الإفصاح إلى توزيع مسؤولية آلي.", en: "Assess possible independent concurrent causes; this disclosure is not an automated responsibility allocation." },
  },
  {
    id: "quantum",
    title: { ar: "أساس الكمية أو التكلفة", en: "Quantum or cost basis" },
    detail: { ar: "راجع مصدر الكميات والتكاليف وافصلها عن الأثر الزمني وقرار الاستحقاق.", en: "Review the source of quantities and costs; keep them separate from time impact and entitlement decisions." },
  },
];

export function createClaimReviewDisclosures(): ClaimReviewDisclosures {
  return {
    "cause-basis": false,
    "change-authority": false,
    mitigation: false,
    concurrency: false,
    quantum: false,
  };
}

export type WorkflowCheck = {
  id: string;
  title: string;
  state: WorkflowCheckState;
  detail: string;
};

type WorkflowValidationInput = {
  schedule: Schedule;
  selectedEvent: Fragnet | null;
  analysis: TiaResult | WindowTiaResult | null;
  evidenceCount: number;
  noticeCount: number;
  reviewStatus?: string | null;
  isAuthenticated: boolean;
  hasEventResources: boolean;
  templateReady: boolean;
  reviewDisclosures?: Partial<ClaimReviewDisclosures>;
};

export function evaluateWorkflowReadiness(
  input: WorkflowValidationInput,
  language: AppLanguage = "ar"
): WorkflowCheck[] {
  const txt = (ar: string, en: string) => (language === "en" ? en : ar);
  const isP6Source = input.schedule.source === "xer" || input.schedule.source === "p6-xml";
  const impactDays = input.analysis ? ("totalImpactDays" in input.analysis ? input.analysis.totalImpactDays : input.analysis.impactDays) : null;
  const engineQuality = evaluateTiaResultQuality({ schedule: input.schedule, selectedEvent: input.selectedEvent, analysis: input.analysis });
  const scheduleQuality = assessScheduleQuality(input.schedule);
  const reviewDisclosures = {
    ...createClaimReviewDisclosures(),
    ...input.reviewDisclosures,
  };

  return [
    {
      id: "schedule",
      title: txt("نسخة البرنامج", "Schedule version"),
      state: input.schedule.activities.length ? (isP6Source ? "pass" : "attention") : "blocked",
      detail: !input.schedule.activities.length ? txt("استورد أو أنشئ جدولاً يتضمن أنشطة قبل بدء التحليل.", "Import or create a schedule with activities before starting the analysis.") : isP6Source ? txt(`تم تحميل ${input.schedule.activities.length} نشاطاً من Primavera.`, `${input.schedule.activities.length} activities were loaded from Primavera.`) : txt("الجدول صالح للتجربة، لكن استخدم XER أو P6 XML معتمداً للتحليل التعاقدي.", "The schedule is suitable for exploration, but use an approved XER or P6 XML file for contractual analysis."),
    },
    {
      id: "logic",
      title: txt("منطق الشبكة", "Network logic"),
      state: !input.schedule.activities.length ? "blocked" : input.schedule.relationships.length ? "pass" : "attention",
      detail: input.schedule.relationships.length ? txt(`توجد ${input.schedule.relationships.length} علاقة منطقية قابلة لحساب CPM.`, `${input.schedule.relationships.length} logical relationships are available for CPM calculation.`) : txt("لا توجد علاقات منطقية؛ راجع الروابط قبل الاعتماد على المسار الحرج.", "No logical relationships are available; review links before relying on the critical path."),
    },
    {
      id: "schedule-quality",
      title: txt("بوابة جودة البرنامج", "Schedule quality gate"),
      state: scheduleQuality.analysisReadiness === "blocked" ? "blocked" : scheduleQuality.analysisReadiness === "review" ? "attention" : "pass",
      detail: scheduleQuality.analysisReadiness === "blocked"
        ? txt(`أوقفت بوابة الجودة التحليل: ${scheduleQuality.summary.blockers} مانع فني في شبكة البرنامج أو تقويمه. لا يصدر التقرير قبل المعالجة.`, `The quality gate blocked analysis: ${scheduleQuality.summary.blockers} technical blocker(s) affect the schedule network or calendar. The report cannot be issued before resolution.`)
        : scheduleQuality.analysisReadiness === "review"
          ? txt(`لا توجد موانع آلية، لكن توجد ${scheduleQuality.summary.warnings} نقطة تحتاج مراجعة مهنية قبل التصدير.`, `There are no automated blockers, but ${scheduleQuality.summary.warnings} item(s) need professional review before export.`)
          : txt("اجتازت نسخة البرنامج قواعد الجودة الداخلية القابلة للحساب؛ لا يعد ذلك حكماً تعاقدياً أو اعتماداً من Primavera.", "The schedule passed the calculable internal quality rules; this is not a contractual finding or Primavera approval."),
    },
    {
      id: "event",
      title: txt("حدث التأخير", "Delay event"),
      state: !input.selectedEvent ? "blocked" : input.selectedEvent.activities.length ? "pass" : "attention",
      detail: !input.selectedEvent ? txt("اختر أو أنشئ حدث Fragnet واربطه بتاريخ وسبب واضحين.", "Select or create a Fragnet event and link it to a clear date and cause.") : input.selectedEvent.activities.length ? txt(`الحدث ${input.selectedEvent.id} يحتوي على ${input.selectedEvent.activities.length} نشاط Fragnet.`, `Event ${input.selectedEvent.id} contains ${input.selectedEvent.activities.length} Fragnet activity(ies).`) : txt("أضف أنشطة Fragnet إلى الحدث ليظهر أثره في التحليل.", "Add Fragnet activities to the event for its impact to appear in the analysis."),
    },
    {
      id: "tia",
      title: txt("نتيجة TIA", "TIA result"),
      state: input.analysis ? "pass" : "blocked",
      detail: input.analysis ? txt(`تم حساب أثر زمني مقداره ${impactDays ?? 0} يوم.`, `A time impact of ${impactDays ?? 0} day(s) was calculated.`) : txt("شغّل تحليل TIA قبل إعداد Notice أو التقرير.", "Run TIA before preparing a Notice or report."),
    },
    {
      id: "engine-quality",
      title: txt("قرار جودة نتيجة TIA", "TIA result quality decision"),
      state: engineQuality.state === "accepted" ? "pass" : engineQuality.state === "rejected" ? "blocked" : "attention",
      detail: engineQuality.summary,
    },
    {
      id: "financial",
      title: txt("الأثر المالي", "Financial impact"),
      state: !input.selectedEvent ? "info" : input.hasEventResources ? "pass" : "attention",
      detail: !input.selectedEvent ? txt("يُفحص الأثر المالي بعد اختيار حدث.", "Financial impact is checked after selecting an event.") : input.hasEventResources ? txt("تم ربط مورد واحد أو أكثر بأنشطة الحدث لحساب تكلفة التمديد.", "One or more resources are linked to event activities for extension-cost calculation.") : txt("لا توجد إسنادات موارد مرتبطة بأنشطة الحدث؛ راجع TASKRSRC أو أدخل البيانات اللازمة.", "No resource assignments are linked to event activities; review TASKRSRC or enter the required data."),
    },
    {
      id: "evidence",
      title: txt("سجل الأدلة", "Evidence register"),
      state: !input.isAuthenticated ? "info" : input.evidenceCount ? "pass" : "attention",
      detail: !input.isAuthenticated ? txt("سجل الدخول لإرفاق الأدلة وحفظها في السجل الآمن.", "Sign in to attach evidence and save it in the secure register.") : input.evidenceCount ? txt(`تم ربط ${input.evidenceCount} دليل/أدلة بالحدث المختار.`, `${input.evidenceCount} evidence item(s) are linked to the selected event.`) : txt("أرفق المراسلات والتعليمات والبرنامج المرجعي قبل تقديم المطالبة.", "Attach correspondence, instructions and the reference programme before submitting the claim."),
    },
    {
      id: "notice",
      title: txt("Notice التعاقدي", "Contract notice"),
      state: !input.isAuthenticated ? "info" : input.noticeCount ? "pass" : "attention",
      detail: !input.isAuthenticated ? txt("يتطلب إنشاء وحفظ Notice تسجيل الدخول.", "Creating and saving a Notice requires sign-in.") : input.noticeCount ? txt("يوجد Notice محفوظ؛ راجع تاريخ الاستحقاق وحالته قبل الإرسال.", "A Notice is saved; review its due date and status before sending.") : txt("أنشئ مسودة Notice مرتبطة بالحدث وحدد البند التعاقدي وموعد الإشعار.", "Create a Notice draft linked to the event, then define the contract clause and notice date."),
    },
    {
      id: "review",
      title: txt("الاعتماد الإلكتروني", "Electronic approval"),
      state: !input.isAuthenticated ? "info" : input.reviewStatus === "ready_to_export" ? "pass" : "attention",
      detail: !input.isAuthenticated ? txt("سجل الدخول لتفعيل مسار المراجعة وتدقيق القرارات.", "Sign in to activate the review workflow and audit decisions.") : input.reviewStatus === "ready_to_export" ? txt("اكتمل مسار المراجعة وأصبحت المطالبة جاهزة للتصدير.", "The review workflow is complete and the claim is ready for export.") : txt("عيّن المراجعين بالاسم وأكمل مراحل التخطيط والعقود ومدير المطالبات.", "Assign reviewers by name and complete planning, contracts and claims-manager stages."),
    },
    {
      id: "report",
      title: txt("قالب التقرير", "Report template"),
      state: input.templateReady ? "pass" : "attention",
      detail: input.templateReady ? txt("الحقول الأساسية للقالب جاهزة لتوليد Word أو PDF.", "The template's core fields are ready to generate Word or PDF.") : txt("أكمل عنوان التقرير والمخاطب والمرجع التعاقدي قبل التصدير الرسمي.", "Complete the report title, recipient and contract reference before formal export."),
    },
    ...claimReviewDisclosureDefinitions.map(definition => ({
      id: `review-${definition.id}`,
      title: txt(definition.title.ar, definition.title.en),
      state: reviewDisclosures[definition.id] ? "pass" as const : "attention" as const,
      detail: reviewDisclosures[definition.id]
        ? txt("تم إقرار هذه النقطة للمراجعة المهنية؛ لا تعد نتيجة آلية أو قرار استحقاق.", "This item has been acknowledged for professional review; it is not an automated finding or entitlement decision.")
        : txt(definition.detail.ar, definition.detail.en),
    })),
  ];
}

export function workflowReadinessSummary(
  checks: WorkflowCheck[],
  language: AppLanguage = "ar"
) {
  const blocked = checks.filter((check) => check.state === "blocked").length;
  const attention = checks.filter((check) => check.state === "attention").length;
  if (blocked)
    return language === "en"
      ? `${blocked} blocking step(s) need resolution before the claim file can be treated as complete.`
      : `توجد ${blocked} خطوة مانعة تحتاج معالجة قبل اعتبار ملف المطالبة مكتملًا.`;
  if (attention)
    return language === "en"
      ? `There are no blocking steps, but ${attention} item(s) need professional review before export.`
      : `لا توجد خطوات مانعة، لكن توجد ${attention} نقاط تحتاج مراجعة مهنية قبل التصدير.`;
  return language === "en"
    ? "All automated checks passed; professional and contractual review remain the project team's responsibility."
    : "اجتازت جميع نقاط التحقق الآلي؛ تبقى المراجعة المهنية والتعاقدية مسؤولية فريق المشروع.";
}
