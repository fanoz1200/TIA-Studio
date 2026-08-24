import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClaimDocxBlob, buildClaimPdfBlob, buildFullClaimFactPack, claimReportSections, type ClaimReportPayload } from "./claim-export";

const payload: ClaimReportPayload = {
  projectName: "مشروع المحطة المركزية",
  scheduleSource: "p6-xml",
  baselineFinish: "2026-06-30",
  impactedFinish: "2026-07-09",
  impactDays: 9,
  methodology: "Time Impact Analysis (TIA)",
  narrative: "أظهر إدراج الـ Fragnet أثراً مباشراً قدره تسعة أيام عمل على مسار الإكمال الحرج.\n\nسجل التزامن: EV-001 × EV-002 — نافذة WIN-004، من 2026-05-09 إلى 2026-05-12؛ المسؤولية الظاهرة: mixed؛ المعالجة: apportioned.",
  template: { title: "إشعار مطالبة بتمديد مدة", recipient: "المهندس", contractReference: "CON-2026-14", introduction: "تم إخطار صاحب العمل بالحدث.", entitlementPosition: "يطلب المقاول مراجعة الاستحقاق.", reliefRequested: "تمديد تسعة أيام عمل.", closing: "يرجى إصدار القرار." },
  events: [{ id: "D-01", title: "تأخر اعتماد رسومات", occurrenceDate: "2026-03-10", duration: 9, cause: "تعليمات صاحب العمل" }],
  evidence: [{ title: "خطاب متابعة", fileName: "LTR-01.pdf", evidenceType: "correspondence", description: "إشعار أثر زمني", receivedAt: "2026-03-12" }],
  generatedAt: "2026-04-01T10:00:00.000Z",
};

const originalFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe("claim report exporters", () => {
  it("creates ordered claim sections containing schedule, narrative, events, and evidence", () => {
    const sections = claimReportSections(payload);
    expect(sections.map((section) => section.heading)).toContain("6. السرد التحليلي — Delay Analysis Narrative");
    expect(sections.find((section) => section.heading === "3. منهج تحليل التأخير والنتيجة")?.body).toContain("+9 يوم عمل");
    expect(sections.find((section) => section.heading === "6. السرد التحليلي — Delay Analysis Narrative")?.body).toContain("تسعة أيام");
    expect(sections.find((section) => section.heading === "6. السرد التحليلي — Delay Analysis Narrative")?.body).toContain("WIN-004");
    expect(sections.find((section) => section.heading === "6. السرد التحليلي — Delay Analysis Narrative")?.body).toContain("mixed");
    expect(sections.find((section) => section.heading === "6. السرد التحليلي — Delay Analysis Narrative")?.body).toContain("apportioned");
  });

  it("includes financial exposure, notices, and review status when the claim has them", () => {
    const sections = claimReportSections({
      ...payload,
      financialImpact: { dailyCost: 340, extensionCost: 3060, byResourceType: [{ label: "عمالة", dailyCost: 240, extensionCost: 2160 }, { label: "معدات / غير عمالة", dailyCost: 100, extensionCost: 900 }], warnings: ["بيان تكلفة واحد يحتاج مراجعة."] },
      notices: [{ noticeNo: "N-001", eventKey: "D-01", status: "under_review", narrative: "إشعار أولي مع حفظ الحقوق. EV-001 × EV-002 — نافذة WIN-004، من 2026-05-09 إلى 2026-05-12؛ المسؤولية: mixed؛ المعالجة: apportioned.", timeImpactDays: 9, costImpact: 3060, noticeDueDate: "2026-03-17" }],
      review: { currentStage: "contract_review", status: "in_review", auditCount: 3 },
    });
    expect(sections.find((section) => section.heading === "8. ملخص الأثر المالي التشغيلي")?.body).toContain("٣٬٠٦٠");
    expect(sections.find((section) => section.heading === "5. سجل الإشعارات المرتبطة")?.body).toContain("N-001");
    expect(sections.find((section) => section.heading === "5. سجل الإشعارات المرتبطة")?.body).toContain("WIN-004");
    expect(sections.find((section) => section.heading === "9. حالة المراجعة الإلكترونية")?.body).toContain("contract_review");
  });

  it("adds the auditable schedule-quality summary and result-source limits when supplied", () => {
    const sections = claimReportSections({
      ...payload,
      scheduleQuality: {
        scheduleFingerprint: "SQ-1a2b3c4d", generatedAt: "2026-04-01T10:00:00.000Z", analysisReadiness: "review", exportReadiness: "review",
        summary: { passed: 9, warnings: 2, blockers: 0 },
        rules: [{ id: "SQ-010", title: "تاريخ البيانات", severity: "warning", detail: "لا يوجد تاريخ بيانات محدد.", action: "أدخل Data Date." }],
      },
      resultSources: ["مصدر البرنامج: P6 XML.", "محرك الحساب: CPM محلي."],
    });
    expect(sections.find((section) => section.heading === "بوابة جودة البرنامج الزمني")?.body).toContain("SQ-010");
    expect(sections.find((section) => section.heading === "بوابة جودة البرنامج الزمني")?.body).toContain("يتطلب مراجعة مهنية");
    expect(sections.find((section) => section.heading === "4. مصادر النتائج وحدودها")?.body).toContain("CPM محلي");
  });

  it("creates a fact pack that identifies missing claim materials instead of inventing them", () => {
    const factPack = buildFullClaimFactPack({ ...payload, evidence: [], notices: [] });
    expect(factPack.schemaVersion).toBe("1.0");
    expect(factPack.analysis.impactDays).toBe(9);
    expect(factPack.missingItems.join(" ")).toContain("فهرس الأدلة");
    expect(factPack.missingItems.join(" ")).toContain("الإشعارات");
    expect(factPack.professionalLimits.join(" ")).toContain("ليست رأياً قانونياً");
  });

  it("generates a valid DOCX package", async () => {
    const blob = await buildClaimDocxBlob(payload);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.size).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 2))).toBe("PK");
  });

  it("generates a valid Arabic-capable PDF package", async () => {
    const font = await readFile(path.resolve(import.meta.dirname, "../../../../webdev-static-assets/Amiri-Regular.ttf"));
    globalThis.fetch = vi.fn(async () => new Response(font, { status: 200 }));
    const blob = await buildClaimPdfBlob(payload);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.size).toBeGreaterThan(1_000);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });
});
