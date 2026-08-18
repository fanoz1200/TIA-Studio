import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClaimDocxBlob, buildClaimPdfBlob, claimReportSections, type ClaimReportPayload } from "./claim-export";

const payload: ClaimReportPayload = {
  projectName: "مشروع المحطة المركزية",
  scheduleSource: "p6-xml",
  baselineFinish: "2026-06-30",
  impactedFinish: "2026-07-09",
  impactDays: 9,
  methodology: "Time Impact Analysis (TIA)",
  narrative: "أظهر إدراج الـ Fragnet أثراً مباشراً قدره تسعة أيام عمل على مسار الإكمال الحرج.",
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
    expect(sections.map((section) => section.heading)).toContain("السرد التحليلي");
    expect(sections.find((section) => section.heading === "ملخص المطالبة")?.body).toContain("+9 يوم عمل");
    expect(sections.find((section) => section.heading === "السرد التحليلي")?.body).toContain("تسعة أيام");
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
