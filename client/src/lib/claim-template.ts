import type { AppLanguage } from "@/lib/language";

export type EditableClaimEotDraftInput = {
  language: AppLanguage;
  projectName: string;
  referenceNo: string;
  sender: string;
  recipient: string;
  contractClause: string;
  eventId: string;
  eventTitle: string;
  occurrenceDate: string;
  awarenessDate: string;
  noticeDueDate: string;
  timeImpactDays: number;
  financialExposure: string;
  narrative: string;
  technicalNarrative: string;
  evidenceReferences: string[];
  windowAnalysisNote: string;
};

const valueOr = (value: string, fallback: string) => value.trim() || fallback;

/**
 * Local working-outline only. The template intentionally separates the
 * technical record from any contractual entitlement or final legal position.
 */
export function buildEditableClaimEotDraft(
  input: EditableClaimEotDraftInput
) {
  const en = input.language === "en";
  const unspecified = en ? "Not specified — complete during review" : "غير محدد — يُستكمل عند المراجعة";
  const review = en
    ? "Review against the contract and project record before reliance."
    : "تُراجع هذه الخانة مع العقد وسجل المشروع قبل الاعتماد.";
  const evidence = input.evidenceReferences.length
    ? input.evidenceReferences.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : en
      ? "No evidence references were selected. Complete the evidence schedule."
      : "لم تُحدَّد مراجع أدلة. استكمل جدول الأدلة.";

  return en
    ? [
        "TIA Studio — Editable EOT / Claim Working Draft",
        "LOCAL WORKING DRAFT ONLY — it is not sent, does not decide entitlement, and does not calculate contractual notice periods.",
        "",
        "1. Cover / reference",
        `Project: ${valueOr(input.projectName, unspecified)}`,
        `Reference: ${valueOr(input.referenceNo, unspecified)}`,
        `From: ${valueOr(input.sender, unspecified)}`,
        `To: ${valueOr(input.recipient, unspecified)}`,
        `Contract clause(s) for review: ${valueOr(input.contractClause, unspecified)}`,
        "",
        "2. Purpose and reservation",
        "State the purpose of the submission and any reservation of rights in wording approved for the particular contract.",
        "",
        "3. Event and chronology",
        `Event: ${input.eventId} — ${input.eventTitle}`,
        `Event date: ${valueOr(input.occurrenceDate, unspecified)}`,
        `Awareness date: ${valueOr(input.awarenessDate, unspecified)}`,
        `Notice due date recorded for review: ${valueOr(input.noticeDueDate, unspecified)}`,
        `Event summary: ${valueOr(input.narrative, unspecified)}`,
        "",
        "4. Technical delay analysis",
        `Preliminary schedule impact shown by the selected local analysis: ${Math.max(0, input.timeImpactDays)} day(s).`,
        "This is a technical working input, not an entitlement conclusion. Identify the analysis method, source schedule versions, data dates, calendars, constraints, and analyst checks in the final submission.",
        `Window / time-slice note: ${valueOr(input.windowAnalysisNote, review)}`,
        `Technical narrative: ${valueOr(input.technicalNarrative, unspecified)}`,
        "",
        "5. Cost and disruption record",
        `Preliminary financial exposure shown by the current local inputs: ${valueOr(input.financialExposure, unspecified)}`,
        "Separate cost build-up, records, causation, mitigation, and contractual valuation from the technical schedule result.",
        "",
        "6. Evidence schedule",
        evidence,
        "",
        "7. Position and requested action",
        "Complete the requested action, contractual basis, and all qualifications only after contract and management review. This template does not make an automatic EOT, payment, liability, or entitlement determination.",
        "",
        "8. Review checklist",
        "- Verify dates, notice requirements, clause references, names, evidence, and attachments against the governing contract and project record.",
        "- Confirm schedule source versions and quality checks before relying on any time-slice or TIA observation.",
        "- Obtain authorised technical, commercial, and legal review before issue or transmission.",
      ].join("\n")
    : [
        "TIA Studio — مسودة Claim / EOT قابلة للتعديل",
        "مسودة عمل محلية فقط — لا تُرسل، ولا تقرر استحقاقاً، ولا تحسب مهلاً تعاقدية تلقائياً.",
        "",
        "1. الغلاف والمرجع",
        `المشروع: ${valueOr(input.projectName, unspecified)}`,
        `المرجع: ${valueOr(input.referenceNo, unspecified)}`,
        `من: ${valueOr(input.sender, unspecified)}`,
        `إلى: ${valueOr(input.recipient, unspecified)}`,
        `بنود العقد للمراجعة: ${valueOr(input.contractClause, unspecified)}`,
        "",
        "2. الغرض وحفظ الحقوق",
        "اكتب غرض المراسلة وصياغة حفظ الحقوق المعتمدة للحالة والعقد المعنيين.",
        "",
        "3. الواقعة والتسلسل الزمني",
        `الواقعة: ${input.eventId} — ${input.eventTitle}`,
        `تاريخ الواقعة: ${valueOr(input.occurrenceDate, unspecified)}`,
        `تاريخ العلم: ${valueOr(input.awarenessDate, unspecified)}`,
        `موعد الإشعار المسجل للمراجعة: ${valueOr(input.noticeDueDate, unspecified)}`,
        `ملخص الواقعة: ${valueOr(input.narrative, unspecified)}`,
        "",
        "4. التحليل الفني للتأخير",
        `الأثر الزمني المبدئي الظاهر من التحليل المحلي المختار: ${Math.max(0, input.timeImpactDays)} يوم.`,
        "هذه مدخلة فنية للعمل وليست نتيجة استحقاق. في النسخة النهائية عرّف المنهج ونسخ البرنامج وData Dates والتقاويم والقيود وفحوص المحلل.",
        `ملاحظة Window / Time Slice: ${valueOr(input.windowAnalysisNote, review)}`,
        `السرد الفني: ${valueOr(input.technicalNarrative, unspecified)}`,
        "",
        "5. سجل التكلفة والتعطيل",
        `التعرض المالي المبدئي الظاهر من المدخلات المحلية الحالية: ${valueOr(input.financialExposure, unspecified)}`,
        "افصل تفصيل التكلفة والسجلات والسببية والتخفيف والتقييم التعاقدي عن نتيجة البرنامج الفنية.",
        "",
        "6. جدول الأدلة",
        evidence,
        "",
        "7. الموقف والإجراء المطلوب",
        "استكمل الإجراء المطلوب والأساس التعاقدي والتحفظات بعد مراجعة العقد والإدارة فقط. هذا القالب لا يصدر قرار EOT أو دفع أو مسؤولية أو استحقاق تلقائياً.",
        "",
        "8. قائمة المراجعة",
        "- راجع التواريخ ومهلات الإشعار والبنود والأسماء والأدلة والمرفقات مع العقد الحاكم وسجل المشروع.",
        "- تحقق من نسخ البرنامج وفحوص الجودة قبل الاعتماد على أي ملاحظة Time Slice أو TIA.",
        "- احصل على مراجعة فنية وتجارية وقانونية معتمدة قبل الإصدار أو الإرسال.",
      ].join("\n");
}
