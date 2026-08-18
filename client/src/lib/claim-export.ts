import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";

const ARABIC_FONT_URL = "/manus-storage/Amiri-Regular_1361616e.ttf";

export type ClaimTemplateDraft = {
  title: string;
  recipient: string;
  contractReference: string;
  introduction: string;
  entitlementPosition: string;
  reliefRequested: string;
  closing: string;
};

export type ClaimEvidence = {
  title: string;
  fileName: string;
  evidenceType: string;
  description?: string | null;
  receivedAt?: Date | string | null;
};

export type ClaimReportPayload = {
  projectName: string;
  scheduleSource?: string;
  baselineFinish: string;
  impactedFinish: string;
  impactDays: number;
  methodology: string;
  narrative: string;
  template: ClaimTemplateDraft;
  events: Array<{ id: string; title: string; occurrenceDate: string; duration: number; cause: string }>;
  evidence: ClaimEvidence[];
  generatedAt: string;
};

function fileStem(projectName: string) {
  return projectName.replace(/[^\w\u0600-\u06FF]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "tia-claim";
}

function dateText(value?: Date | string | null) {
  if (!value) return "غير محدد";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("ar-EG", { timeZone: "UTC" });
}

export function claimReportSections(payload: ClaimReportPayload) {
  const template = payload.template;
  return [
    { heading: template.title || "إشعار مطالبة بتمديد مدة", body: "" },
    { heading: "المخاطب والمرجع", body: `إلى: ${template.recipient || "يحدد عند الإصدار"}\nمرجع العقد: ${template.contractReference || "يحدد عند الإصدار"}` },
    { heading: "ملخص المطالبة", body: `المشروع: ${payload.projectName}\nتاريخ الإكمال الأساسي: ${payload.baselineFinish}\nتاريخ الإكمال بعد التحليل: ${payload.impactedFinish}\nالأثر الزمني المحسوب: ${payload.impactDays >= 0 ? "+" : ""}${payload.impactDays} يوم عمل\nالمنهج: ${payload.methodology}` },
    { heading: "تمهيد", body: template.introduction || "يقدم هذا المستند ملخصاً فنياً لحدث/أحداث التأخير وتقييم أثرها الزمني على برنامج المشروع." },
    { heading: "السرد التحليلي", body: payload.narrative },
    { heading: "الموقف التعاقدي المطلوب", body: template.entitlementPosition || "يُراجع الاستحقاق التعاقدي في ضوء العقد والإشعارات والوقائع والأدلة المرفقة. لا يشكل هذا التحليل وحده رأياً قانونياً." },
    { heading: "التمديد/الإغاثة المطلوبة", body: template.reliefRequested || `يُطلب اعتماد أثر زمني قدره ${payload.impactDays >= 0 ? "+" : ""}${payload.impactDays} يوم عمل، خاضعاً للمراجعة التعاقدية وتدقيق البرنامج والأدلة.` },
    { heading: "الخاتمة", body: template.closing || "يرجى مراجعة هذه المطالبة وإصدار القرار وفق آلية العقد." },
  ];
}

function evidenceLines(evidence: ClaimEvidence[]) {
  if (!evidence.length) return ["لا توجد أدلة مرفقة بالحدث المختار."];
  return evidence.map((item, index) => `${index + 1}. ${item.title} — ${item.fileName} — ${item.evidenceType} — تاريخ الاستلام: ${dateText(item.receivedAt)}${item.description ? ` — ${item.description}` : ""}`);
}

function eventLines(events: ClaimReportPayload["events"]) {
  if (!events.length) return ["لا توجد أحداث مسجلة في نسخة التحليل الحالية."];
  return events.map((event) => `${event.id}: ${event.title} | ${event.occurrenceDate} | ${event.duration} يوم عمل | السبب: ${event.cause}`);
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function buildClaimDocxBlob(payload: ClaimReportPayload) {
  const paragraphs: Paragraph[] = [];
  for (const section of claimReportSections(payload)) {
    paragraphs.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT }));
    section.body.split("\n").filter(Boolean).forEach((line) => paragraphs.push(new Paragraph({ text: line, alignment: AlignmentType.RIGHT })));
  }
  paragraphs.push(new Paragraph({ text: "سجل أحداث التأخير", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT }));
  eventLines(payload.events).forEach((line) => paragraphs.push(new Paragraph({ text: line, alignment: AlignmentType.RIGHT, bullet: { level: 0 } })));
  paragraphs.push(new Paragraph({ text: "سجل الأدلة والمستندات", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.RIGHT }));
  evidenceLines(payload.evidence).forEach((line) => paragraphs.push(new Paragraph({ text: line, alignment: AlignmentType.RIGHT, bullet: { level: 0 } })));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: `أُنشئ بواسطة TIA Studio في ${dateText(payload.generatedAt)}`, italics: true })], alignment: AlignmentType.RIGHT }));
  const document = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(document);
}

export async function exportClaimDocx(payload: ClaimReportPayload) {
  downloadBlob(`${fileStem(payload.projectName)}-delay-claim.docx`, await buildClaimDocxBlob(payload));
}

function bytesToBase64(bytes: ArrayBuffer) {
  const array = new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < array.length; index += 0x8000) binary += String.fromCharCode.apply(null, Array.from(array.subarray(index, index + 0x8000)));
  return btoa(binary);
}

async function registerArabicFont(document: jsPDF) {
  const response = await fetch(ARABIC_FONT_URL);
  if (!response.ok) throw new Error("تعذر تحميل خط التقرير العربي.");
  document.addFileToVFS("Amiri-Regular.ttf", bytesToBase64(await response.arrayBuffer()));
  document.addFont("Amiri-Regular.ttf", "Amiri", "normal");
  document.setFont("Amiri", "normal");
}

export async function buildClaimPdfBlob(payload: ClaimReportPayload) {
  const document = new jsPDF({ unit: "mm", format: "a4" });
  await registerArabicFont(document);
  const width = document.internal.pageSize.getWidth();
  const height = document.internal.pageSize.getHeight();
  const margin = 16;
  let y = 18;
  const write = (text: string, size = 12, bold = false) => {
    document.setFont("Amiri", "normal");
    document.setFontSize(size);
    const lines = document.splitTextToSize(text, width - margin * 2) as string[];
    lines.forEach((line) => {
      if (y > height - 20) { document.addPage(); y = 18; }
      const shaped = (document as unknown as { processArabic?: (source: string) => string }).processArabic?.(line) ?? line;
      document.text(shaped, width - margin, y, { align: "right" });
      y += size * 0.52;
    });
    y += 2;
  };
  claimReportSections(payload).forEach((section) => { write(section.heading, 17, true); write(section.body, 12); });
  write("سجل أحداث التأخير", 17, true); eventLines(payload.events).forEach((line) => write(line, 11));
  write("سجل الأدلة والمستندات", 17, true); evidenceLines(payload.evidence).forEach((line) => write(line, 11));
  write(`أُنشئ بواسطة TIA Studio في ${dateText(payload.generatedAt)}`, 10);
  return document.output("blob") as Blob;
}

export async function exportClaimPdf(payload: ClaimReportPayload) {
  downloadBlob(`${fileStem(payload.projectName)}-delay-claim.pdf`, await buildClaimPdfBlob(payload));
}
