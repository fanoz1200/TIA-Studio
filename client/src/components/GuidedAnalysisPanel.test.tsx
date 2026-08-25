// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidedAnalysisPanel, type ScheduleSnapshot } from "./GuidedAnalysisPanel";
import { fiveDayCalendar, type Schedule } from "@/lib/cpm";
import { parseIssueRegisterExcel } from "@/lib/issue-excel";
import { LanguageProvider } from "@/contexts/LanguageContext";

vi.mock("@/lib/issue-excel", () => ({
  downloadIssueImportTemplate: vi.fn(),
  parseIssueRegisterExcel: vi.fn(),
}));

const importedSchedule: Schedule = {
  id: "P6-TRAINING", name: "برنامج تدريبي", startDate: "2026-01-01", dataDate: "2026-01-05", calendar: fiveDayCalendar,
  source: "xer", activities: [{ id: "A100", name: "الحفر", duration: 5 }, { id: "A200", name: "الأساسات", duration: 4 }],
  relationships: [{ id: "R1", predecessorId: "A100", successorId: "A200", type: "FS" }],
};
const summary = { projectName: "Training P6", activitiesRead: 2, relationshipsRead: 1, wbsRead: 1, resourcesRead: 0, resourceAssignmentsRead: 0, assignmentsWithCosts: 0, activitiesWithProgress: 0, calendarName: "Five Day", warnings: [], tablesFound: ["TASK", "TASKPRED"] };
const baseline: ScheduleSnapshot = { id: "BL-1", stage: "baseline", fileName: "baseline.xer", schedule: importedSchedule, summary };
const preUpdate: ScheduleSnapshot = { id: "UP-1", stage: "pre-event-update", fileName: "update-before-event.xer", schedule: importedSchedule, summary };

function renderPanel(overrides: Partial<React.ComponentProps<typeof GuidedAnalysisPanel>> = {}, interfaceLanguage: "ar" | "en" = "ar") {
  window.localStorage.setItem("tia-studio-interface-language", interfaceLanguage);
  const props: React.ComponentProps<typeof GuidedAnalysisPanel> = {
    schedule: importedSchedule, xerSummary: summary, journeyStep: 1, journeyPath: null, p6GateApproved: false, qualityGateApproved: false, isXerImporting: false, baselineSnapshot: null, updateSnapshots: [],
    onJourneyPathChange: vi.fn(), onJourneyStepChange: vi.fn(), onP6GateApprovedChange: vi.fn(), onQualityGateApprovedChange: vi.fn(), onScheduleUpload: vi.fn().mockResolvedValue(undefined), onApplyIssueExcel: vi.fn(), onPrepareSplit: vi.fn(), onNavigate: vi.fn(),
    ...overrides,
  };
  render(<LanguageProvider><GuidedAnalysisPanel {...props} /></LanguageProvider>);
  return props;
}

describe("معالج رحلة TIA وفق Workshop 8", () => {
  afterEach(cleanup);
  it("يختار التحليل المباشر ثم يسمح بالانتقال إلى اختيار المنهج", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /تحليل مباشر/ }));
    expect(props.onJourneyPathChange).toHaveBeenCalledWith("direct");
    cleanup();
    const directProps = renderPanel({ journeyPath: "direct" });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(directProps.onJourneyStepChange).toHaveBeenCalledWith(2);
  });

  it("لا يسمح بتجاوز Baseline في خطوة الملفات الإلزامية", () => {
    const props = renderPanel({ journeyStep: 3, journeyPath: "direct" });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(props.onJourneyStepChange).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "ارفع Baseline المعتمد" })).toBeTruthy();
    expect(screen.getByText(/ارفع ملف Baseline المعتمد الأول/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "التالي" }).hasAttribute("disabled")).toBe(true);
  });

  it("يعرض بوابة P6 وتحذيرات الاستيراد مع Update قبل الحدث", () => {
    const warningSummary = { ...summary, warnings: ["لم يُقرأ تقويم مخصص للنشاط A200."] };
    renderPanel({ journeyStep: 4, journeyPath: "direct", baselineSnapshot: baseline, updateSnapshots: [{ ...preUpdate, summary: warningSummary }], xerSummary: warningSummary });
    expect(screen.getByRole("heading", { name: "Update قبل الحدث وبوابة الجودة" })).toBeTruthy();
    expect(screen.getByText(/لم يُقرأ تقويم مخصص/)).toBeTruthy();
    expect(screen.getByLabelText(/أقرّ بمراجعة بيانات P6/)).toBeTruthy();
    expect(screen.getByLabelText(/راجعت بوابة الجودة/)).toBeTruthy();
  });

  it("لا يسمح بتجاوز بوابة الجودة قبل إدخال الواقعة", () => {
    const props = renderPanel({ journeyStep: 4, journeyPath: "direct", baselineSnapshot: baseline, updateSnapshots: [preUpdate], p6GateApproved: true, qualityGateApproved: false });
    expect(screen.getByRole("button", { name: "التالي" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/راجع عدادات الجدول والتقويم وData Date/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "افتح فحص الجدول" }));
    expect(props.onNavigate).toHaveBeenCalledWith("quality");
  });

  it("يعرض معاينة تقسيم النشاط إلى Pre وEvent وPost قبل الحساب", () => {
    renderPanel({ journeyStep: 6, journeyPath: "direct", baselineSnapshot: baseline, updateSnapshots: [preUpdate] });
    const split = screen.getByText(/راجع تقسيم النشاط/).closest(".guided-content") as HTMLElement;
    expect(within(split).getByText("Pre")).toBeTruthy();
    expect(within(split).getByText("Event")).toBeTruthy();
    expect(within(split).getByText("Post")).toBeTruthy();
  });

  it("يمنع المتابعة من سجل Workshop 8 حتى تضاف واقعة كاملة للمراجعة", () => {
    const props = renderPanel({ journeyStep: 5, journeyPath: "direct", baselineSnapshot: baseline, updateSnapshots: [preUpdate] });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(props.onJourneyStepChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "أضف الواقعة للنموذج" }));
    expect(screen.getByText(/جاهز للمراجعة: 1 واقعة منظمة/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(props.onJourneyStepChange).toHaveBeenCalledWith(6);
  });

  it("يراجع صف Excel المرفوع ويرسله إلى سجل القضايا قبل المتابعة", async () => {
    const reviewedRow = {
      rowNumber: 2, issueNo: "W8-001", title: "تأخر اعتماد", occurrenceDate: "2026-01-04", reportedBy: "المخطط",
      responsibleParty: "employer" as const, delayCause: "employer" as const, criticality: "potentially_critical" as const,
      proposedDurationDays: 2, replacedRelationshipId: "R1", affectedActivityIds: ["A100"], description: "تأخر اعتماد مخططات.",
      impactSummary: "يحتاج نمذجة TIA.", referenceNotes: "مرجع W8-001.",
    };
    vi.mocked(parseIssueRegisterExcel).mockReturnValue({ rows: [reviewedRow], errors: [], totalRows: 1 });
    const props = renderPanel({ journeyStep: 5, journeyPath: "issue", baselineSnapshot: baseline, updateSnapshots: [preUpdate] });
    const input = document.querySelector('input[accept=".xlsx,.xls"]') as HTMLInputElement;
    const file = new File(["workshop"], "workshop-8.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(new ArrayBuffer(8)) });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/جاهز للمراجعة: 1 واقعة منظمة/)).toBeTruthy();
    expect(parseIssueRegisterExcel).toHaveBeenCalled();
    expect(props.onApplyIssueExcel).toHaveBeenCalledWith([reviewedRow]);
  });

  it("يعرض رحلة English باتجاه LTR مع إبقاء بيانات النشاط المستوردة كما هي", () => {
    const props = renderPanel({ journeyStep: 5, journeyPath: "direct", baselineSnapshot: baseline, updateSnapshots: [preUpdate] }, "en");
    const panel = screen.getByRole("heading", { name: "Structured event register — Workshop 8" }).closest("section");
    expect(panel?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("button", { name: "Add event to the form" })).toBeTruthy();
    expect(screen.getByText("A100 — الحفر")).toBeTruthy();
    expect(props.onApplyIssueExcel).not.toHaveBeenCalled();
  });
});
