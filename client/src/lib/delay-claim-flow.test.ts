import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addNoticePeriod, nextReviewState } from "../../../server/claimWorkflow";
import { buildClaimDocxBlob, buildClaimPdfBlob, claimReportSections, type ClaimReportPayload } from "./claim-export";
import { calculateFinancialImpact, resourceAssignmentsForEvent, type Fragnet } from "./cpm";
import { importXerSchedule } from "./xer";

const xerFlow = `%T\tPROJECT
%F\tproj_short_name\tplan_start_date
%R\tبرج التكامل\t2026-03-01
%E
%T\tTASK
%F\ttask_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tearly_start_date
%R\tT-100\tA100\tأعمال الأساسات\t80\t40\t2026-03-01
%R\tT-200\tA200\tأعمال خارج النطاق\t80\t80\t2026-03-01
%E
%T\tRSRC
%F\trsrc_id\trsrc_name\trsrc_type
%R\tR-EXC\tحفار\tNonLabor
%R\tR-OTH\tمورد بعيد\tLabor
%E
%T\tTASKRSRC
%F\ttaskrsrc_id\ttask_id\trsrc_id\trsrc_type\tremain_cost\tcost_per_qty\tremain_qty_per_hr
%R\tTR-01\tT-100\tR-EXC\tNonLabor\t2500\t50\t1
%R\tTR-02\tT-200\tR-OTH\tLabor\t800\t10\t1
%E`;

describe("delay-claim end-to-end flow", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it("limits P6 cost exposure to the event, prepares its notice date, progresses review, and produces DOCX/PDF", async () => {
    const { schedule } = importXerSchedule(xerFlow, "integration.xer");
    const event: Fragnet = {
      id: "EV-101", title: "تعذر الوصول لمنطقة العمل", description: "اختبار تدفق", cause: "employer", occurrenceDate: "2026-03-05",
      activities: [{ id: "F-101", name: "انتظار معالجة العائق", duration: 3 }],
      relationships: [{ id: "L-1", predecessorId: "T-100", successorId: "F-101", type: "FS" }],
    };

    const scopedResources = resourceAssignmentsForEvent(schedule, event);
    const financial = calculateFinancialImpact(3, scopedResources, 8);
    expect(scopedResources.map(item => item.activityId)).toEqual(["T-100"]);
    expect(financial.dailyCost).toBe(400);
    expect(financial.extensionCost).toBe(1200);

    expect(addNoticePeriod(event.occurrenceDate, 7)).toBe("2026-03-12");
    expect(nextReviewState("draft", "draft", "submitted")).toEqual({ stage: "planning_review", status: "in_review" });
    expect(nextReviewState("planning_review", "in_review", "approved")).toEqual({ stage: "contract_review", status: "in_review" });

    const reportPayload: ClaimReportPayload = {
      projectName: schedule.name, baselineFinish: "2026-03-10", impactedFinish: "2026-03-13", impactDays: 3, methodology: "TIA", narrative: "سرد تحليلي اختبار", generatedAt: "2026-03-06",
      template: { title: "مطالبة اختبار", recipient: "المهندس", contractReference: "8.4", introduction: "", entitlementPosition: "", reliefRequested: "", closing: "" },
      events: [{ id: event.id, title: event.title, occurrenceDate: event.occurrenceDate, duration: 3, cause: event.cause }], evidence: [{ title: "محضر عائق", fileName: "obstruction.pdf", evidenceType: "محضر" }],
      financialImpact: { dailyCost: financial.dailyCost, extensionCost: financial.extensionCost, byResourceType: [{ label: "معدات / غير عمالة", dailyCost: 400, extensionCost: 1200 }] },
      notices: [{ noticeNo: "AUTO-EV-101", eventKey: event.id, status: "draft", narrative: "مسودة تلقائية", timeImpactDays: 3, costImpact: financial.extensionCost, noticeDueDate: "2026-03-12" }],
      review: { currentStage: "contract_review", status: "in_review", auditCount: 2, participants: [{ stage: "contract_review", reviewerId: 41 }] },
    };
    const sections = claimReportSections(reportPayload);
    expect(sections.map(section => section.heading)).toEqual(expect.arrayContaining(["5. سجل الإشعارات المرتبطة", "8. ملخص الأثر المالي التشغيلي", "9. حالة المراجعة الإلكترونية"]));
    expect(sections.find(section => section.heading === "5. سجل الإشعارات المرتبطة")?.body).toContain("AUTO-EV-101");
    expect(sections.find(section => section.heading === "9. حالة المراجعة الإلكترونية")?.body).toContain("المستخدم رقم 41");

    const docx = await buildClaimDocxBlob(reportPayload);
    expect(new TextDecoder().decode((await docx.arrayBuffer()).slice(0, 2))).toBe("PK");
    const font = await readFile(path.resolve(import.meta.dirname, "../../../../webdev-static-assets/Amiri-Regular.ttf"));
    globalThis.fetch = vi.fn(async () => new Response(font, { status: 200 }));
    const pdf = await buildClaimPdfBlob(reportPayload);
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 4))).toBe("%PDF");
  });
});
