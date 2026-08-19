import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import type { ScheduleQualityAssessment } from "./schedule-quality";

const ARABIC_FONT_URL = "/manus-storage/Amiri-Regular_1361616e.ttf";

export type ClaimTemplateDraft = { title: string; recipient: string; contractReference: string; introduction: string; entitlementPosition: string; reliefRequested: string; closing: string };
export type ClaimEvidence = { title: string; fileName: string; evidenceType: string; description?: string | null; receivedAt?: Date | string | null };
export type ClaimFinancialImpact = { dailyCost: number; extensionCost: number; currencyLabel?: string; byResourceType: Array<{ label: string; dailyCost: number; extensionCost: number }>; warnings?: string[] };
export type ClaimNotice = { noticeNo: string; eventKey: string; status: string; narrative: string; timeImpactDays: number; costImpact: number; noticeDueDate?: Date | string | null };
export type ClaimReviewSummary = { currentStage: string; status: string; auditCount: number; participants?: Array<{ stage: string; reviewerId: number }> };
export type ClaimReportPayload = {
  projectName: string; scheduleSource?: string; baselineFinish: string; impactedFinish: string; impactDays: number; methodology: string; narrative: string;
  template: ClaimTemplateDraft; events: Array<{ id: string; title: string; occurrenceDate: string; duration: number; cause: string }>; evidence: ClaimEvidence[];
  financialImpact?: ClaimFinancialImpact; notices?: ClaimNotice[]; review?: ClaimReviewSummary | null; scheduleQuality?: ScheduleQualityAssessment; resultSources?: string[]; generatedAt: string;
};

function fileStem(projectName: string) { return projectName.replace(/[^\w\u0600-\u06FF]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "tia-claim"; }
function dateText(value?: Date | string | null) { if (!value) return "غير محدد"; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("ar-EG", { timeZone: "UTC" }); }
function money(value: number, label = "وحدة نقدية") { return `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value)} ${label}`; }

export function claimReportSections(payload: ClaimReportPayload) {
  const template = payload.template;
  const sections = [
    { heading: template.title || "إشعار مطالبة بتمديد مدة", body: "" },
    { heading: "المخاطب والمرجع", body: `إلى: ${template.recipient || "يحدد عند الإصدار"}\nمرجع العقد: ${template.contractReference || "يحدد عند الإصدار"}` },
    { heading: "ملخص المطالبة", body: `المشروع: ${payload.projectName}\nتاريخ الإكمال الأساسي: ${payload.baselineFinish}\nتاريخ الإكمال بعد التحليل: ${payload.impactedFinish}\nالأثر الزمني المحسوب: ${payload.impactDays >= 0 ? "+" : ""}${payload.impactDays} يوم عمل\nالمنهج: ${payload.methodology}` },
  ];
  if (payload.scheduleQuality) {
    const quality = payload.scheduleQuality;
    const state = quality.analysisReadiness === "ready" ? "جاهز حسابياً" : quality.analysisReadiness === "review" ? "يتطلب مراجعة مهنية" : "ممنوع حسابياً";
    const flagged = quality.rules.filter((item) => item.severity !== "pass");
    sections.push({ heading: "بوابة جودة البرنامج الزمني", body: `الحالة الآلية: ${state}\nبصمة النسخة: ${quality.scheduleFingerprint}\nقواعد مجتازة: ${quality.summary.passed} | تحذيرات: ${quality.summary.warnings} | موانع: ${quality.summary.blockers}\n${flagged.length ? `نقاط المراجعة: ${flagged.map((item) => `${item.id} — ${item.title}: ${item.detail}`).join(" | ")}` : "لا توجد نقاط معلّمة في قواعد الجودة الداخلية."}\nهذه بوابة فنية قابلة للحساب؛ لا تمثل اعتماد Primavera أو حكماً تعاقدياً أو قرار استحقاق.` });
  }
  if (payload.resultSources?.length) sections.push({ heading: "مصادر النتائج وحدودها", body: `${payload.resultSources.map((source, index) => `${index + 1}. ${source}`).join("\n")}\nتستند النتائج إلى النسخة والافتراضات المعروضة فقط، وتظل مراجعة العقد والبيانات الأصلية والمسار المنطقي مسؤولية فريق المشروع.` });
  if (payload.financialImpact) {
    const label = payload.financialImpact.currencyLabel || "وحدة نقدية";
    const breakdown = payload.financialImpact.byResourceType.map(item => `${item.label}: تكلفة يومية ${money(item.dailyCost, label)}؛ تعرض التمديد ${money(item.extensionCost, label)}`).join("\n");
    sections.push({ heading: "ملخص الأثر المالي التشغيلي", body: `التكلفة اليومية المشتقة من إسنادات P6: ${money(payload.financialImpact.dailyCost, label)}\nتعرض تكلفة التمديد: ${money(payload.financialImpact.extensionCost, label)}\n${breakdown || "لا توجد إسنادات موارد قابلة للحساب."}\nهذه قيمة تخطيطية مشتقة من بيانات الموارد وليست حكماً بالاستحقاق أو مبلغ مطالبة نهائي.${payload.financialImpact.warnings?.length ? `\nتنبيهات بيانات: ${payload.financialImpact.warnings.join(" | ")}` : ""}` });
  }
  if (payload.notices?.length) sections.push({ heading: "سجل الإشعارات المرتبطة", body: payload.notices.map(notice => `${notice.noticeNo} | الحدث: ${notice.eventKey} | الحالة: ${notice.status} | الاستحقاق: ${dateText(notice.noticeDueDate)} | الأثر: ${notice.timeImpactDays} يوم / ${money(notice.costImpact)}\n${notice.narrative}`).join("\n\n") });
  if (payload.review) {
    const assignees = payload.review.participants?.length ? `\nتعيينات المراجعة: ${payload.review.participants.map(item => `${item.stage} ← المستخدم رقم ${item.reviewerId}`).join(" | ")}` : "";
    sections.push({ heading: "حالة المراجعة الإلكترونية", body: `المرحلة الحالية: ${payload.review.currentStage}\nالحالة: ${payload.review.status}\nعدد قيود سجل التدقيق: ${payload.review.auditCount}${assignees}` });
  }
  sections.push(
    { heading: "تمهيد", body: template.introduction || "يقدم هذا المستند ملخصاً فنياً لحدث/أحداث التأخير وتقييم أثرها الزمني على برنامج المشروع." },
    { heading: "السرد التحليلي", body: payload.narrative },
    { heading: "الموقف التعاقدي المطلوب", body: template.entitlementPosition || "يُراجع الاستحقاق التعاقدي في ضوء العقد والإشعارات والوقائع والأدلة المرفقة. لا يشكل هذا التحليل وحده رأياً قانونياً." },
    { heading: "التمديد/الإغاثة المطلوبة", body: template.reliefRequested || `يُطلب اعتماد أثر زمني قدره ${payload.impactDays >= 0 ? "+" : ""}${payload.impactDays} يوم عمل، خاضعاً للمراجعة التعاقدية وتدقيق البرنامج والأدلة.` },
    { heading: "الخاتمة", body: template.closing || "يرجى مراجعة هذه المطالبة وإصدار القرار وفق آلية العقد." },
  );
  return sections;
}

function evidenceLines(evidence: ClaimEvidence[]) { return evidence.length ? evidence.map((item, index) => `${index + 1}. ${item.title} — ${item.fileName} — ${item.evidenceType} — تاريخ الاستلام: ${dateText(item.receivedAt)}${item.description ? ` — ${item.description}` : ""}`) : ["لا توجد أدلة مرفقة بالحدث المختار."]; }
function eventLines(events: ClaimReportPayload["events"]) { return events.length ? events.map(event => `${event.id}: ${event.title} | ${event.occurrenceDate} | ${event.duration} يوم عمل | السبب: ${event.cause}`) : ["لا توجد أحداث مسجلة في نسخة التحليل الحالية."]; }
function downloadBlob(name: string, blob: Blob) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }

export async function buildClaimDocxBlob(payload: ClaimReportPayload) {
  const paragraphs: Paragraph[] = [];
  for (const section of claimReportSections(payload)) { paragraphs.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT })); section.body.split("\n").filter(Boolean).forEach(line => paragraphs.push(new Paragraph({ text: line, alignment: AlignmentType.RIGHT }))); }
  paragraphs.push(new Paragraph({ text: "سجل أحداث التأخير", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT })); eventLines(payload.events).forEach(line => paragraphs.push(new Paragraph({ text: line, alignment: AlignmentType.RIGHT, bullet: { level: 0 } })));
  paragraphs.push(new Paragraph({ text: "سجل الأدلة والمستندات", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT })); evidenceLines(payload.evidence).forEach(line => paragraphs.push(new Paragraph({ text: line, alignment: AlignmentType.RIGHT, bullet: { level: 0 } })));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: `أُنشئ بواسطة TIA Studio في ${dateText(payload.generatedAt)}`, italics: true })], alignment: AlignmentType.RIGHT }));
  return Packer.toBlob(new Document({ sections: [{ children: paragraphs }] }));
}
export async function exportClaimDocx(payload: ClaimReportPayload) { downloadBlob(`${fileStem(payload.projectName)}-delay-claim.docx`, await buildClaimDocxBlob(payload)); }

function bytesToBase64(bytes: ArrayBuffer) { const array = new Uint8Array(bytes); let binary = ""; for (let index = 0; index < array.length; index += 0x8000) binary += String.fromCharCode.apply(null, Array.from(array.subarray(index, index + 0x8000))); return btoa(binary); }
async function registerArabicFont(document: jsPDF) { const response = await fetch(ARABIC_FONT_URL); if (!response.ok) throw new Error("تعذر تحميل خط التقرير العربي."); document.addFileToVFS("Amiri-Regular.ttf", bytesToBase64(await response.arrayBuffer())); document.addFont("Amiri-Regular.ttf", "Amiri", "normal"); document.setFont("Amiri", "normal"); }

export async function buildClaimPdfBlob(payload: ClaimReportPayload) {
  const document = new jsPDF({ unit: "mm", format: "a4" }); await registerArabicFont(document); const width = document.internal.pageSize.getWidth(); const height = document.internal.pageSize.getHeight(); const margin = 16; let y = 18;
  const write = (text: string, size = 12) => { document.setFont("Amiri", "normal"); document.setFontSize(size); const lines = document.splitTextToSize(text, width - margin * 2) as string[]; lines.forEach(line => { if (y > height - 20) { document.addPage(); y = 18; } const shaped = (document as unknown as { processArabic?: (source: string) => string }).processArabic?.(line) ?? line; document.text(shaped, width - margin, y, { align: "right" }); y += size * 0.52; }); y += 2; };
  const drawQualityMeter = (quality: ScheduleQualityAssessment) => {
    if (y > height - 34) { document.addPage(); y = 18; }
    const total = Math.max(1, quality.summary.passed + quality.summary.warnings + quality.summary.blockers);
    const meterWidth = width - margin * 2; const meterHeight = 7; let x = margin;
    ([{ count: quality.summary.passed, color: [16, 126, 90] }, { count: quality.summary.warnings, color: [210, 138, 27] }, { count: quality.summary.blockers, color: [190, 48, 48] }] as const).forEach((part) => { const segment = meterWidth * part.count / total; if (segment > 0) { document.setFillColor(part.color[0], part.color[1], part.color[2]); document.rect(x, y, segment, meterHeight, "F"); x += segment; } });
    document.setDrawColor(140, 148, 160); document.rect(margin, y, meterWidth, meterHeight); y += meterHeight + 4;
  };
  claimReportSections(payload).forEach(section => { write(section.heading, 17); write(section.body, 12); if (section.heading === "بوابة جودة البرنامج الزمني" && payload.scheduleQuality) drawQualityMeter(payload.scheduleQuality); }); write("سجل أحداث التأخير", 17); eventLines(payload.events).forEach(line => write(line, 11)); write("سجل الأدلة والمستندات", 17); evidenceLines(payload.evidence).forEach(line => write(line, 11)); write(`أُنشئ بواسطة TIA Studio في ${dateText(payload.generatedAt)}`, 10);
  return document.output("blob") as Blob;
}
export async function exportClaimPdf(payload: ClaimReportPayload) { downloadBlob(`${fileStem(payload.projectName)}-delay-claim.pdf`, await buildClaimPdfBlob(payload)); }
