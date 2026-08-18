// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuidedAnalysisPanel } from "./GuidedAnalysisPanel";
import { fiveDayCalendar, type Schedule } from "@/lib/cpm";

const importedSchedule: Schedule = {
  id: "P6-TRAINING", name: "برنامج تدريبي", startDate: "2026-01-01", dataDate: "2026-01-05", calendar: fiveDayCalendar,
  source: "xer", activities: [{ id: "A100", name: "الحفر", duration: 5 }, { id: "A200", name: "الأساسات", duration: 4 }],
  relationships: [{ id: "R1", predecessorId: "A100", successorId: "A200", type: "FS" }],
};

const summary = {
  projectName: "Training P6", activitiesRead: 2, relationshipsRead: 1, wbsRead: 1, resourcesRead: 0,
  resourceAssignmentsRead: 0, assignmentsWithCosts: 0, activitiesWithProgress: 0, calendarName: "Five Day",
  warnings: [], tablesFound: ["TASK", "TASKPRED"],
};

describe("معالج رحلة TIA", () => {
  it("يختار التحليل المباشر ثم يوجّه المستخدم إلى رفع البرنامج", () => {
    const onJourneyPath = vi.fn();
    const onStepChange = vi.fn();
    const onNavigate = vi.fn();
    render(<GuidedAnalysisPanel schedule={importedSchedule} summary={summary} step={1} journeyPath={null} approvedP6Gate={false} onP6GateApprovalChange={vi.fn()} onJourneyPath={onJourneyPath} onStepChange={onStepChange} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: /التحليل المباشر/ }));
    expect(onJourneyPath).toHaveBeenCalledWith("direct");
    expect(onStepChange).toHaveBeenCalledWith(2);
    expect(onNavigate).toHaveBeenCalledWith("schedule");
  });

  it("لا يسمح بالانتقال إلى الحدث قبل رفع ملف P6 ومراجعة بوابة الاستيراد", () => {
    const onNavigate = vi.fn();
    const manualSchedule = { ...importedSchedule, source: "manual" as const };
    render(<GuidedAnalysisPanel schedule={manualSchedule} summary={null} step={2} journeyPath="direct" approvedP6Gate={false} onP6GateApprovalChange={vi.fn()} onJourneyPath={vi.fn()} onStepChange={vi.fn()} onNavigate={onNavigate} />);

    expect((screen.getByRole("button", { name: /انتقل لتحديد الحدث/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /رفع برنامج P6/ }));
    expect(onNavigate).toHaveBeenCalledWith("schedule");
  });

  it("يعرض عدّادات الأنشطة والعلاقات والتقاويم وملاحظات الاستيراد داخل بوابة P6", () => {
    const warningSummary = { ...summary, warnings: ["لم يُقرأ تقويم مخصص للنشاط A200."] };
    render(<GuidedAnalysisPanel schedule={importedSchedule} summary={warningSummary} step={2} journeyPath="direct" approvedP6Gate={false} onP6GateApprovalChange={vi.fn()} onJourneyPath={vi.fn()} onStepChange={vi.fn()} onNavigate={vi.fn()} />);

    const evidence = screen.getByLabelText("ملخص قراءات برنامج P6");
    expect(within(evidence).getByText("الأنشطة")).toBeTruthy();
    expect(within(evidence).getByText("العلاقات")).toBeTruthy();
    expect(within(evidence).getByText("WBS")).toBeTruthy();
    expect(within(evidence).getByText("الموارد")).toBeTruthy();
    expect(within(evidence).getByText(/لم يُقرأ تقويم مخصص/)).toBeTruthy();
  });

  it("يحجب فتح نموذج الحدث حتى اعتماد نسخة Pre-TIA المرجعية", () => {
    const onNavigate = vi.fn();
    const onStepChange = vi.fn();
    render(<GuidedAnalysisPanel schedule={importedSchedule} summary={summary} step={3} journeyPath="direct" approvedP6Gate onP6GateApprovalChange={vi.fn()} onJourneyPath={vi.fn()} onStepChange={onStepChange} onNavigate={onNavigate} />);

    const openEvent = screen.getByRole("button", { name: /افتح نموذج الحدث/ }) as HTMLButtonElement;
    expect(openEvent.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /أعتمد البرنامج المستورد الحالي/ }));
    expect(openEvent.disabled).toBe(false);
    fireEvent.click(openEvent);
    expect(onStepChange).toHaveBeenCalledWith(4);
    expect(onNavigate).toHaveBeenCalledWith("event");
  });
});
