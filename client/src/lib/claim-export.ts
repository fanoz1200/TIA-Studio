import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun, TableOfContents } from "docx";
import { jsPDF } from "jspdf";
import type { ScheduleQualityAssessment } from "./schedule-quality";
import type { DocumentLanguage } from "./language";

const ARABIC_FONT_URL = "/manus-storage/Amiri-Regular_1361616e.ttf";

export type ClaimTemplateDraft = { title: string; recipient: string; contractReference: string; introduction: string; entitlementPosition: string; reliefRequested: string; closing: string };
export type ClaimEvidence = { title: string; fileName: string; evidenceType: string; description?: string | null; receivedAt?: Date | string | null };
export type ClaimFinancialImpact = { dailyCost: number; extensionCost: number; currencyLabel?: string; byResourceType: Array<{ label: string; dailyCost: number; extensionCost: number }>; warnings?: string[] };
export type ClaimNotice = { noticeNo: string; eventKey: string; status: string; narrative: string; timeImpactDays: number; costImpact: number; noticeDueDate?: Date | string | null };
export type ClaimReviewSummary = { currentStage: string; status: string; auditCount: number; participants?: Array<{ stage: string; reviewerId: number }> };
export type ClaimReportPayload = {
  language?: DocumentLanguage;
  projectName: string; scheduleSource?: string; baselineFinish: string; impactedFinish: string; impactDays: number; methodology: string; narrative: string;
  template: ClaimTemplateDraft; events: Array<{ id: string; title: string; occurrenceDate: string; duration: number; cause: string }>; evidence: ClaimEvidence[];
  financialImpact?: ClaimFinancialImpact; notices?: ClaimNotice[]; review?: ClaimReviewSummary | null; scheduleQuality?: ScheduleQualityAssessment; resultSources?: string[]; generatedAt: string;
};

export type FullClaimFactPack = {
  schemaVersion: "1.0";
  generatedAt: string;
  document: { title: string; recipient: string; contractReference: string; language: DocumentLanguage };
  project: { name: string; scheduleSource: string; baselineFinish: string; impactedFinish: string };
  analysis: { methodology: string; impactDays: number; narrative: string; events: ClaimReportPayload["events"] };
  evidence: ClaimEvidence[];
  notices: ClaimNotice[];
  financialImpact?: ClaimFinancialImpact;
  scheduleQuality?: ScheduleQualityAssessment;
  resultSources: string[];
  review?: ClaimReviewSummary | null;
  missingItems: string[];
  professionalLimits: string[];
};

function fileStem(projectName: string) { return projectName.replace(/[^\w\u0600-\u06FF]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "tia-claim"; }
function outputLanguage(payload: Pick<ClaimReportPayload, "language">): DocumentLanguage { return payload.language ?? "ar"; }
function dateText(value?: Date | string | null, language: DocumentLanguage = "ar") { if (!value) return language === "en" ? "Not specified" : "غير محدد"; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(language === "en" ? "en-GB" : "ar-EG", { timeZone: "UTC" }); }
function money(value: number, label = "وحدة نقدية", language: DocumentLanguage = "ar") { return `${new Intl.NumberFormat(language === "en" ? "en-GB" : "ar-EG", { maximumFractionDigits: 2 }).format(value)} ${label}`; }

export function buildFullClaimFactPack(payload: ClaimReportPayload): FullClaimFactPack {
  const language = outputLanguage(payload);
  const english = language === "en";
  const missingItems: string[] = [];
  if (!payload.template.recipient.trim()) missingItems.push(english ? "Recipient name and issuing-party details." : "اسم المخاطب وبيانات جهة الإصدار.");
  if (!payload.template.contractReference.trim()) missingItems.push(english ? "Contract reference and relevant contract clause(s)." : "مرجع العقد والبند/البنود التعاقدية ذات الصلة.");
  if (!payload.events.length) missingItems.push(english ? "At least one documented delay event in the event register." : "حدث تأخير واحد على الأقل موثق في سجل الأحداث.");
  if (!payload.evidence.length) missingItems.push(english ? "Evidence index and supporting records linked to each event." : "فهرس الأدلة والمستندات المؤيدة وربط كل دليل بالحدث.");
  if (!payload.notices?.length) missingItems.push(english ? "Contractual notice register, dates, and issue status." : "سجل الإشعارات التعاقدية ومواعيدها وحالة الإرسال.");
  if (!payload.financialImpact) missingItems.push(english ? "Basis for financial-impact assessment and any recoverable cost, if applicable." : "أساس قياس الأثر المالي والتكلفة المسموح بالمطالبة بها، إن وجدت.");
  missingItems.push(english ? "Gantt attachments, Primavera screenshots, or the original schedule documents relied upon by the reviewer." : "مرفقات Gantt/لقطات Primavera أو مستندات البرنامج الأصلية التي يعتمد عليها المراجع.");
  return {
    schemaVersion: "1.0",
    generatedAt: payload.generatedAt,
    document: { title: payload.template.title || "Full Claim / Delay Analysis Narrative", recipient: payload.template.recipient, contractReference: payload.template.contractReference, language },
    project: { name: payload.projectName, scheduleSource: payload.scheduleSource || (english ? "Not specified" : "غير محدد"), baselineFinish: payload.baselineFinish, impactedFinish: payload.impactedFinish },
    analysis: { methodology: payload.methodology, impactDays: payload.impactDays, narrative: payload.narrative, events: payload.events },
    evidence: payload.evidence,
    notices: payload.notices ?? [],
    financialImpact: payload.financialImpact,
    scheduleQuality: payload.scheduleQuality,
    resultSources: payload.resultSources ?? [],
    review: payload.review,
    missingItems,
    professionalLimits: [
      english ? "This is an editable technical draft, not legal advice or a determination of entitlement." : "هذه مسودة فنية قابلة للتحرير وليست رأياً قانونياً أو حكماً بالاستحقاق.",
      english ? "The contract, notices, evidence, and original schedule must be reviewed before any external submission." : "يجب مراجعة العقد والإشعارات والأدلة والبرنامج الأصلي قبل التقديم الخارجي.",
      english ? "This report does not establish Primavera equivalence; any XER should be re-tested in a non-production project when needed." : "لا يثبت هذا التقرير تكافؤ Primavera؛ يعاد اختبار أي XER في مشروع غير إنتاجي عند الحاجة.",
    ],
  };
}

function englishClaimReportSections(payload: ClaimReportPayload) {
  const template = payload.template;
  const factPack = buildFullClaimFactPack(payload);
  const quality = payload.scheduleQuality;
  const qualityState = quality ? quality.analysisReadiness === "ready" ? "Computationally ready" : quality.analysisReadiness === "review" ? "Professional review required" : "Computationally blocked" : "No schedule-quality result attached";
  const flaggedQuality = quality?.rules.filter(item => item.severity !== "pass") ?? [];
  const sources = payload.resultSources?.length ? payload.resultSources.map((source, index) => `${index + 1}. ${source}`).join("\n") : "No result sources are recorded in the current analysis copy; an undocumented source must not be added.";
  const notices = payload.notices?.length ? payload.notices.map(notice => `${notice.noticeNo} | Event: ${notice.eventKey} | Status: ${notice.status} | Due date: ${dateText(notice.noticeDueDate, "en")} | Impact: ${notice.timeImpactDays} days / ${money(notice.costImpact, "currency units", "en")}\n${notice.narrative}`).join("\n\n") : "No notices are linked in the current analysis copy; the contracts team must complete the approved notice register.";
  const financial = payload.financialImpact;
  const financialBody = financial ? (() => { const label = financial.currencyLabel || "currency units"; const breakdown = financial.byResourceType.map(item => `${item.label}: daily cost ${money(item.dailyCost, label, "en")}; extension exposure ${money(item.extensionCost, label, "en")}`).join("\n"); return `Daily cost derived from P6 assignments: ${money(financial.dailyCost, label, "en")}\nExtension-cost exposure: ${money(financial.extensionCost, label, "en")}\n${breakdown || "No resource assignments are available for calculation."}\nThis is a planning value derived from resource data; it is not an entitlement determination or final claim amount.${financial.warnings?.length ? `\nData warnings: ${financial.warnings.join(" | ")}` : ""}`; })() : "No computable financial-impact data or resource assignments are available in this analysis copy; no claim amount is generated automatically.";
  const review = payload.review;
  const reviewBody = review ? `Current stage: ${review.currentStage}\nStatus: ${review.status}\nAudit-log entries: ${review.auditCount}${review.participants?.length ? `\nReview assignments: ${review.participants.map(item => `${item.stage} ← user ${item.reviewerId}`).join(" | ")}` : ""}` : "No electronic review status has been recorded for this draft.";
  return [
    { heading: "1. Purpose and scope of draft", body: `This is a Full Claim / Delay Analysis Narrative draft generated from a structured Fact Pack in TIA Studio. It covers the displayed technical impact and does not automatically create contractual or legal entitlement.\nDocument: ${template.title || "To be stated on issue"}\nRecipient: ${template.recipient || "To be stated on issue"}\nContract reference: ${template.contractReference || "To be stated on issue"}` },
    { heading: "2. Project and contract identification", body: `Project: ${payload.projectName}\nSchedule source: ${payload.scheduleSource || "Not specified"}\nContract reference: ${template.contractReference || "To be completed by the contracts team"}\nBaseline completion date: ${payload.baselineFinish}\nCompletion date after analysis: ${payload.impactedFinish}` },
    { heading: "3. Delay-analysis method and result", body: `Method: ${payload.methodology}\nCalculated time impact: ${payload.impactDays >= 0 ? "+" : ""}${payload.impactDays} working days\nThe calculated result below depends only on the stated data and assumptions and requires professional review before use in a claim.` },
    { heading: "Schedule quality gate", body: quality ? `Automated state: ${qualityState}\nSchedule fingerprint: ${quality.scheduleFingerprint}\nPassed rules: ${quality.summary.passed} | Warnings: ${quality.summary.warnings} | Blockers: ${quality.summary.blockers}\n${flaggedQuality.length ? `Review points: ${flaggedQuality.map(item => `${item.id} — ${item.title}: ${item.detail}`).join(" | ")}` : "No issues are marked by the internal quality rules."}\nThis is a computable technical gate; it is not Primavera approval, a contractual finding, or an entitlement decision.` : `${qualityState}. Do not treat this draft as having passed a schedule review until an auditable quality result is attached.` },
    { heading: "4. Result sources and limitations", body: `${sources}\nThe results rely only on the displayed copy and assumptions. Contract review, original data review, and logic-path review remain the project team's responsibility.` },
    { heading: "5. Related notice register", body: notices },
    { heading: "6. Analytical narrative — Delay Analysis Narrative", body: `${template.introduction ? `${template.introduction}\n\n` : ""}${payload.narrative || "Complete the narrative from approved analysis facts and evidence."}` },
    { heading: "7. Contract position and relief requested", body: `${template.entitlementPosition || "Contractual entitlement must be reviewed against the contract, notices, facts, and attached evidence. This analysis alone is not legal advice."}\n\n${template.reliefRequested || `Approval is requested for a time impact of ${payload.impactDays >= 0 ? "+" : ""}${payload.impactDays} working days, subject to contract review and schedule and evidence audit.`}` },
    { heading: "8. Operational financial-impact summary", body: financialBody },
    { heading: "9. Electronic review status", body: reviewBody },
    { heading: "10. Required appendices and exhibits", body: "Add here: the source Gantt, approved Primavera screenshots or PDF, reviewed schedule copy, notice register, and copies of the listed evidence. TIA Studio does not create Primavera screenshots or evidence that does not exist." },
    { heading: "11. Missing items before external issue", body: factPack.missingItems.map((item, index) => `${index + 1}. ${item}`).join("\n") },
    { heading: "12. Professional statement and limits", body: `${factPack.professionalLimits.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n${template.closing || "Please review this claim and issue a decision in accordance with the contract procedure."}` },
  ];
}

export function claimReportSections(payload: ClaimReportPayload) {
  if (outputLanguage(payload) === "en") return englishClaimReportSections(payload);
  const template = payload.template;
  const factPack = buildFullClaimFactPack(payload);
  const quality = payload.scheduleQuality;
  const qualityState = quality
    ? quality.analysisReadiness === "ready"
      ? "جاهز حسابياً"
      : quality.analysisReadiness === "review"
        ? "يتطلب مراجعة مهنية"
        : "ممنوع حسابياً"
    : "لم تُرفق نتيجة بوابة الجودة";
  const flaggedQuality = quality?.rules.filter(item => item.severity !== "pass") ?? [];
  const resultSources = payload.resultSources?.length
    ? payload.resultSources.map((source, index) => `${index + 1}. ${source}`).join("\n")
    : "لم تُسجّل مصادر النتائج في نسخة التحليل الحالية؛ لا يجوز إضافة مصدر غير موثق.";
  const notices = payload.notices?.length
    ? payload.notices.map(notice => `${notice.noticeNo} | الحدث: ${notice.eventKey} | الحالة: ${notice.status} | الاستحقاق: ${dateText(notice.noticeDueDate)} | الأثر: ${notice.timeImpactDays} يوم / ${money(notice.costImpact)}\n${notice.narrative}`).join("\n\n")
    : "لا توجد إشعارات مرتبطة في نسخة التحليل الحالية؛ يستكمل فريق العقود سجل الإشعارات المعتمد.";
  const financial = payload.financialImpact;
  const financialBody = financial
    ? (() => {
        const label = financial.currencyLabel || "وحدة نقدية";
        const breakdown = financial.byResourceType.map(item => `${item.label}: تكلفة يومية ${money(item.dailyCost, label)}؛ تعرض التمديد ${money(item.extensionCost, label)}`).join("\n");
        return `التكلفة اليومية المشتقة من إسنادات P6: ${money(financial.dailyCost, label)}\nتعرض تكلفة التمديد: ${money(financial.extensionCost, label)}\n${breakdown || "لا توجد إسنادات موارد قابلة للحساب."}\nهذه قيمة تخطيطية مشتقة من بيانات الموارد وليست حكماً بالاستحقاق أو مبلغ مطالبة نهائي.${financial.warnings?.length ? `\nتنبيهات بيانات: ${financial.warnings.join(" | ")}` : ""}`;
      })()
    : "لا تتوافر بيانات أثر مالي أو إسنادات موارد قابلة للحساب في نسخة التحليل الحالية؛ لا يُنشأ مبلغ مطالبة تلقائياً.";
  const review = payload.review;
  const reviewBody = review
    ? `المرحلة الحالية: ${review.currentStage}\nالحالة: ${review.status}\nعدد قيود سجل التدقيق: ${review.auditCount}${review.participants?.length ? `\nتعيينات المراجعة: ${review.participants.map(item => `${item.stage} ← المستخدم رقم ${item.reviewerId}`).join(" | ")}` : ""}`
    : "لم تُسجّل حالة مراجعة إلكترونية لهذه المسودة بعد.";

  return [
    { heading: "1. الغرض ونطاق المسودة", body: `هذه مسودة Full Claim / Delay Analysis Narrative مولدة من Fact Pack منظم داخل TIA Studio. تغطي الأثر الفني المعروض ولا تنشئ استحقاقاً تعاقدياً أو قانونياً تلقائياً.\nالمستند: ${template.title || "يحدد عند الإصدار"}\nالمخاطب: ${template.recipient || "يحدد عند الإصدار"}\nمرجع العقد: ${template.contractReference || "يحدد عند الإصدار"}` },
    { heading: "2. تعريف المشروع والعقد", body: `المشروع: ${payload.projectName}\nمصدر البرنامج: ${payload.scheduleSource || "غير محدد"}\nمرجع العقد: ${template.contractReference || "يستكمل من فريق العقود"}\nتاريخ الإكمال الأساسي: ${payload.baselineFinish}\nتاريخ الإكمال بعد التحليل: ${payload.impactedFinish}` },
    { heading: "3. منهج تحليل التأخير والنتيجة", body: `المنهج: ${payload.methodology}\nالأثر الزمني المحسوب: ${payload.impactDays >= 0 ? "+" : ""}${payload.impactDays} يوم عمل\nالنتيجة الحسابية أدناه تعتمد على البيانات والافتراضات المبيّنة فقط، وتحتاج مراجعة مهنية قبل استخدامها في Claim.` },
    { heading: "بوابة جودة البرنامج الزمني", body: quality ? `الحالة الآلية: ${qualityState}\nبصمة النسخة: ${quality.scheduleFingerprint}\nقواعد مجتازة: ${quality.summary.passed} | تحذيرات: ${quality.summary.warnings} | موانع: ${quality.summary.blockers}\n${flaggedQuality.length ? `نقاط المراجعة: ${flaggedQuality.map(item => `${item.id} — ${item.title}: ${item.detail}`).join(" | ")}` : "لا توجد نقاط معلّمة في قواعد الجودة الداخلية."}\nهذه بوابة فنية قابلة للحساب؛ لا تمثل اعتماد Primavera أو حكماً تعاقدياً أو قرار استحقاق.` : `${qualityState}. لا تُفهم هذه المسودة على أنها اجتازت فحص برنامج زمني حتى ترفق نتيجة جودة قابلة للتدقيق.` },
    { heading: "4. مصادر النتائج وحدودها", body: `${resultSources}\nتستند النتائج إلى النسخة والافتراضات المعروضة فقط، وتظل مراجعة العقد والبيانات الأصلية والمسار المنطقي مسؤولية فريق المشروع.` },
    { heading: "5. سجل الإشعارات المرتبطة", body: notices },
    { heading: "6. السرد التحليلي — Delay Analysis Narrative", body: `${template.introduction ? `${template.introduction}\n\n` : ""}${payload.narrative || "يستكمل السرد من وقائع التحليل والأدلة المعتمدة."}` },
    { heading: "7. الموقف التعاقدي وطلب الإغاثة", body: `${template.entitlementPosition || "يُراجع الاستحقاق التعاقدي في ضوء العقد والإشعارات والوقائع والأدلة المرفقة. لا يشكل هذا التحليل وحده رأياً قانونياً."}\n\n${template.reliefRequested || `يُطلب اعتماد أثر زمني قدره ${payload.impactDays >= 0 ? "+" : ""}${payload.impactDays} يوم عمل، خاضعاً للمراجعة التعاقدية وتدقيق البرنامج والأدلة.`}` },
    { heading: "8. ملخص الأثر المالي التشغيلي", body: financialBody },
    { heading: "9. حالة المراجعة الإلكترونية", body: reviewBody },
    { heading: "10. الملاحق والمخططات المطلوبة", body: "يُضاف إلى هذا الموضع: مخطط Gantt المصدر، لقطات Primavera أو PDF المعتمد، النسخة المراجعة من البرنامج، سجل الإشعارات، ونسخ الأدلة المذكورة. لا ينشئ TIA Studio لقطات Primavera أو أدلة غير موجودة." },
    { heading: "11. نواقص قبل الإصدار الخارجي", body: factPack.missingItems.map((item, index) => `${index + 1}. ${item}`).join("\n") },
    { heading: "12. الإقرار والحدود المهنية", body: `${factPack.professionalLimits.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n${template.closing || "يرجى مراجعة هذه المطالبة وإصدار القرار وفق آلية العقد."}` },
  ];
}

function evidenceLines(evidence: ClaimEvidence[], language: DocumentLanguage = "ar") { return evidence.length ? evidence.map((item, index) => language === "en" ? `${index + 1}. ${item.title} — ${item.fileName} — ${item.evidenceType} — Received: ${dateText(item.receivedAt, "en")}${item.description ? ` — ${item.description}` : ""}` : `${index + 1}. ${item.title} — ${item.fileName} — ${item.evidenceType} — تاريخ الاستلام: ${dateText(item.receivedAt)}${item.description ? ` — ${item.description}` : ""}`) : [language === "en" ? "No evidence is attached to the selected event." : "لا توجد أدلة مرفقة بالحدث المختار."]; }
function eventLines(events: ClaimReportPayload["events"], language: DocumentLanguage = "ar") { return events.length ? events.map(event => language === "en" ? `${event.id}: ${event.title} | ${event.occurrenceDate} | ${event.duration} working days | Cause: ${event.cause}` : `${event.id}: ${event.title} | ${event.occurrenceDate} | ${event.duration} يوم عمل | السبب: ${event.cause}`) : [language === "en" ? "No events are recorded in the current analysis copy." : "لا توجد أحداث مسجلة في نسخة التحليل الحالية."]; }
function downloadBlob(name: string, blob: Blob) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }

export async function buildClaimDocxBlob(payload: ClaimReportPayload) {
  const language = outputLanguage(payload);
  const english = language === "en";
  const alignment = english ? AlignmentType.LEFT : AlignmentType.RIGHT;
  const paragraphs: Paragraph[] = [
    new Paragraph({ text: payload.template.title || "Full Claim / Delay Analysis Narrative", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 2200, after: 360 } }),
    new Paragraph({ text: "TIA Studio — Fact Pack Based Draft", alignment: AlignmentType.CENTER }),
    new Paragraph({ text: english ? `Project: ${payload.projectName}` : `المشروع: ${payload.projectName}`, alignment: AlignmentType.CENTER, spacing: { before: 800 } }),
    new Paragraph({ text: english ? `Contract reference: ${payload.template.contractReference || "To be completed on issue"}` : `مرجع العقد: ${payload.template.contractReference || "يستكمل عند الإصدار"}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: english ? `Recipient: ${payload.template.recipient || "To be completed on issue"}` : `المخاطب: ${payload.template.recipient || "يستكمل عند الإصدار"}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: english ? `Date generated: ${dateText(payload.generatedAt, "en")}` : `تاريخ الإنشاء: ${dateText(payload.generatedAt)}`, alignment: AlignmentType.CENTER, spacing: { before: 400 } }),
    new Paragraph({ text: english ? "Editable technical draft — review the contract, evidence, and original schedule before external issue." : "مسودة فنية قابلة للتحرير — تتطلب مراجعة العقد والأدلة والبرنامج الأصلي قبل أي تقديم خارجي.", alignment: AlignmentType.CENTER, spacing: { before: 1700 } }),
    new Paragraph({ text: english ? "Table of contents" : "فهرس المحتويات", heading: HeadingLevel.HEADING_1, alignment, pageBreakBefore: true }),
  ];
  const toc = new TableOfContents(english ? "Table of contents" : "فهرس المحتويات", { hyperlink: true, headingStyleRange: "1-3" });
  const content: Array<Paragraph | TableOfContents> = [...paragraphs, toc, new Paragraph({ text: english ? "In Word, select References and then Update Table after any edit to refresh page numbers." : "ملاحظة: في Word اختر References ثم Update Table لتحديث أرقام الصفحات بعد أي تعديل.", alignment })];
  for (const section of claimReportSections(payload)) { content.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, alignment })); section.body.split("\n").filter(Boolean).forEach(line => content.push(new Paragraph({ text: line, alignment }))); }
  content.push(new Paragraph({ text: english ? "13. Delay-event register" : "13. سجل أحداث التأخير", heading: HeadingLevel.HEADING_1, alignment })); eventLines(payload.events, language).forEach(line => content.push(new Paragraph({ text: line, alignment, bullet: { level: 0 } })));
  content.push(new Paragraph({ text: english ? "14. Evidence and document index" : "14. فهرس الأدلة والمستندات", heading: HeadingLevel.HEADING_1, alignment })); evidenceLines(payload.evidence, language).forEach(line => content.push(new Paragraph({ text: line, alignment, bullet: { level: 0 } })));
  content.push(new Paragraph({ children: [new TextRun({ text: english ? `Generated by TIA Studio on ${dateText(payload.generatedAt, "en")}` : `أُنشئ بواسطة TIA Studio في ${dateText(payload.generatedAt)}`, italics: true })], alignment }));
  return Packer.toBlob(new Document({ sections: [{ children: content }] }));
}
export async function exportClaimDocx(payload: ClaimReportPayload) { downloadBlob(`${fileStem(payload.projectName)}-delay-claim-${outputLanguage(payload)}.docx`, await buildClaimDocxBlob(payload)); }
export function exportFullClaimFactPack(payload: ClaimReportPayload) { downloadBlob(`${fileStem(payload.projectName)}-claim-fact-pack-${outputLanguage(payload)}.json`, new Blob([JSON.stringify(buildFullClaimFactPack(payload), null, 2)], { type: "application/json" })); }

function bytesToBase64(bytes: ArrayBuffer) { const array = new Uint8Array(bytes); let binary = ""; for (let index = 0; index < array.length; index += 0x8000) binary += String.fromCharCode.apply(null, Array.from(array.subarray(index, index + 0x8000))); return btoa(binary); }
async function registerArabicFont(document: jsPDF) { const response = await fetch(ARABIC_FONT_URL); if (!response.ok) throw new Error("تعذر تحميل خط التقرير العربي."); document.addFileToVFS("Amiri-Regular.ttf", bytesToBase64(await response.arrayBuffer())); document.addFont("Amiri-Regular.ttf", "Amiri", "normal"); document.setFont("Amiri", "normal"); }

export async function buildClaimPdfBlob(payload: ClaimReportPayload) {
  const language = outputLanguage(payload);
  const english = language === "en";
  const document = new jsPDF({ unit: "mm", format: "a4" }); if (!english) await registerArabicFont(document); const width = document.internal.pageSize.getWidth(); const height = document.internal.pageSize.getHeight(); const margin = 16; let y = 18;
  const write = (text: string, size = 12) => { document.setFont(english ? "helvetica" : "Amiri", "normal"); document.setFontSize(size); const lines = document.splitTextToSize(text, width - margin * 2) as string[]; lines.forEach(line => { if (y > height - 20) { document.addPage(); y = 18; } const shaped = english ? line : (document as unknown as { processArabic?: (source: string) => string }).processArabic?.(line) ?? line; document.text(shaped, english ? margin : width - margin, y, { align: english ? "left" : "right" }); y += size * 0.52; }); y += 2; };
  const drawQualityMeter = (quality: ScheduleQualityAssessment) => {
    if (y > height - 34) { document.addPage(); y = 18; }
    const total = Math.max(1, quality.summary.passed + quality.summary.warnings + quality.summary.blockers);
    const meterWidth = width - margin * 2; const meterHeight = 7; let x = margin;
    ([{ count: quality.summary.passed, color: [16, 126, 90] }, { count: quality.summary.warnings, color: [210, 138, 27] }, { count: quality.summary.blockers, color: [190, 48, 48] }] as const).forEach((part) => { const segment = meterWidth * part.count / total; if (segment > 0) { document.setFillColor(part.color[0], part.color[1], part.color[2]); document.rect(x, y, segment, meterHeight, "F"); x += segment; } });
    document.setDrawColor(140, 148, 160); document.rect(margin, y, meterWidth, meterHeight); y += meterHeight + 4;
  };
  claimReportSections(payload).forEach(section => { write(section.heading, 17); write(section.body, 12); if ((section.heading === "بوابة جودة البرنامج الزمني" || section.heading === "Schedule quality gate") && payload.scheduleQuality) drawQualityMeter(payload.scheduleQuality); }); write(english ? "Delay-event register" : "سجل أحداث التأخير", 17); eventLines(payload.events, language).forEach(line => write(line, 11)); write(english ? "Evidence and document index" : "سجل الأدلة والمستندات", 17); evidenceLines(payload.evidence, language).forEach(line => write(line, 11)); write(english ? `Generated by TIA Studio on ${dateText(payload.generatedAt, "en")}` : `أُنشئ بواسطة TIA Studio في ${dateText(payload.generatedAt)}`, 10);
  return document.output("blob") as Blob;
}
export async function exportClaimPdf(payload: ClaimReportPayload) { downloadBlob(`${fileStem(payload.projectName)}-delay-claim-${outputLanguage(payload)}.pdf`, await buildClaimPdfBlob(payload)); }
