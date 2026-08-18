import type { Fragnet, Schedule, TiaResult, WindowTiaResult } from "./cpm";

export type WorkflowCheckState = "pass" | "attention" | "blocked" | "info";

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
};

export function evaluateWorkflowReadiness(input: WorkflowValidationInput): WorkflowCheck[] {
  const isP6Source = input.schedule.source === "xer" || input.schedule.source === "p6-xml";
  const impactDays = input.analysis ? ("totalImpactDays" in input.analysis ? input.analysis.totalImpactDays : input.analysis.impactDays) : null;

  return [
    {
      id: "schedule",
      title: "نسخة البرنامج",
      state: input.schedule.activities.length ? (isP6Source ? "pass" : "attention") : "blocked",
      detail: !input.schedule.activities.length ? "استورد أو أنشئ جدولاً يتضمن أنشطة قبل بدء التحليل." : isP6Source ? `تم تحميل ${input.schedule.activities.length} نشاطاً من Primavera.` : "الجدول صالح للتجربة، لكن استخدم XER أو P6 XML معتمداً للتحليل التعاقدي.",
    },
    {
      id: "logic",
      title: "منطق الشبكة",
      state: !input.schedule.activities.length ? "blocked" : input.schedule.relationships.length ? "pass" : "attention",
      detail: input.schedule.relationships.length ? `توجد ${input.schedule.relationships.length} علاقة منطقية قابلة لحساب CPM.` : "لا توجد علاقات منطقية؛ راجع الروابط قبل الاعتماد على المسار الحرج.",
    },
    {
      id: "event",
      title: "حدث التأخير",
      state: !input.selectedEvent ? "blocked" : input.selectedEvent.activities.length ? "pass" : "attention",
      detail: !input.selectedEvent ? "اختر أو أنشئ حدث Fragnet واربطه بتاريخ وسبب واضحين." : input.selectedEvent.activities.length ? `الحدث ${input.selectedEvent.id} يحتوي على ${input.selectedEvent.activities.length} نشاط Fragnet.` : "أضف أنشطة Fragnet إلى الحدث ليظهر أثره في التحليل.",
    },
    {
      id: "tia",
      title: "نتيجة TIA",
      state: input.analysis ? "pass" : "blocked",
      detail: input.analysis ? `تم حساب أثر زمني مقداره ${impactDays ?? 0} يوم.` : "شغّل تحليل TIA قبل إعداد Notice أو التقرير.",
    },
    {
      id: "financial",
      title: "الأثر المالي",
      state: !input.selectedEvent ? "info" : input.hasEventResources ? "pass" : "attention",
      detail: !input.selectedEvent ? "يُفحص الأثر المالي بعد اختيار حدث." : input.hasEventResources ? "تم ربط مورد واحد أو أكثر بأنشطة الحدث لحساب تكلفة التمديد." : "لا توجد إسنادات موارد مرتبطة بأنشطة الحدث؛ راجع TASKRSRC أو أدخل البيانات اللازمة.",
    },
    {
      id: "evidence",
      title: "سجل الأدلة",
      state: !input.isAuthenticated ? "info" : input.evidenceCount ? "pass" : "attention",
      detail: !input.isAuthenticated ? "سجل الدخول لإرفاق الأدلة وحفظها في السجل الآمن." : input.evidenceCount ? `تم ربط ${input.evidenceCount} دليل/أدلة بالحدث المختار.` : "أرفق المراسلات والتعليمات والبرنامج المرجعي قبل تقديم المطالبة.",
    },
    {
      id: "notice",
      title: "Notice التعاقدي",
      state: !input.isAuthenticated ? "info" : input.noticeCount ? "pass" : "attention",
      detail: !input.isAuthenticated ? "يتطلب إنشاء وحفظ Notice تسجيل الدخول." : input.noticeCount ? "يوجد Notice محفوظ؛ راجع تاريخ الاستحقاق وحالته قبل الإرسال." : "أنشئ مسودة Notice مرتبطة بالحدث وحدد البند التعاقدي وموعد الإشعار.",
    },
    {
      id: "review",
      title: "الاعتماد الإلكتروني",
      state: !input.isAuthenticated ? "info" : input.reviewStatus === "ready_to_export" ? "pass" : "attention",
      detail: !input.isAuthenticated ? "سجل الدخول لتفعيل مسار المراجعة وتدقيق القرارات." : input.reviewStatus === "ready_to_export" ? "اكتمل مسار المراجعة وأصبحت المطالبة جاهزة للتصدير." : "عيّن المراجعين بالاسم وأكمل مراحل التخطيط والعقود ومدير المطالبات.",
    },
    {
      id: "report",
      title: "قالب التقرير",
      state: input.templateReady ? "pass" : "attention",
      detail: input.templateReady ? "الحقول الأساسية للقالب جاهزة لتوليد Word أو PDF." : "أكمل عنوان التقرير والمخاطب والمرجع التعاقدي قبل التصدير الرسمي.",
    },
  ];
}

export function workflowReadinessSummary(checks: WorkflowCheck[]) {
  const blocked = checks.filter((check) => check.state === "blocked").length;
  const attention = checks.filter((check) => check.state === "attention").length;
  if (blocked) return `توجد ${blocked} خطوة مانعة تحتاج معالجة قبل اعتبار ملف المطالبة مكتملًا.`;
  if (attention) return `لا توجد خطوات مانعة، لكن توجد ${attention} نقاط تحتاج مراجعة مهنية قبل التصدير.`;
  return "اجتازت جميع نقاط التحقق الآلي؛ تبقى المراجعة المهنية والتعاقدية مسؤولية فريق المشروع.";
}
