// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { Fragnet, Schedule } from "@/lib/cpm";
import { APP_LANGUAGE_STORAGE_KEY, LanguageProvider } from "@/contexts/LanguageContext";
import { ScheduleComparisonPanel } from "./ScheduleComparisonPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const readExample = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), "examples", name), "utf8")) as Schedule;
let clickSpy: ReturnType<typeof vi.spyOn>;
let createObjectUrlSpy: ReturnType<typeof vi.fn>;
let downloadedNames: string[];

beforeEach(() => {
  downloadedNames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloadedNames.push(this.download); });
  createObjectUrlSpy = vi.fn(() => "blob:comparison-result");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlSpy });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function renderComparison(currentSchedule: Schedule, language: "ar" | "en" = "ar", selectedEvent?: Fragnet, events?: Fragnet[]) {
  localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  return render(<LanguageProvider><ScheduleComparisonPanel currentSchedule={currentSchedule} selectedEvent={selectedEvent} events={events} /></LanguageProvider>);
}

const preservedRawXer = [
  "%T\tPROJECT", "%F\tproj_id\tproj_short_name\tclndr_id\tplan_start_date", "%R\t100\tUI-PRESERVE\t10\t2026-04-01", "%E",
  "%T\tCALENDAR", "%F\tclndr_id\tclndr_name\tclndr_data\tday_hr_cnt", "%R\t10\tP6 Calendar\t(0||0()())\t8", "%E",
  "%T\tPROJWBS", "%F\twbs_id\tproj_id\twbs_short_name\twbs_name\tparent_wbs_id", "%R\t1000\t100\t1.0\tMain WBS\t", "%E",
  "%T\tTASK", "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code", "%R\t1\t100\t1000\t10\tA100\tStart\t16\t16\tTT_Task\tDT_FixedDUR2\tTK_NotStart", "%R\t2\t100\t1000\t10\tA200\tFinish\t16\t16\tTT_Task\tDT_FixedDUR2\tTK_NotStart", "%E",
  "%T\tTASKPRED", "%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt", "%R\t50\t2\t1\t100\t100\tPR_FS\t0", "%E",
].join("\r\n");

const preservedEvent: Fragnet = {
  id: "UI-EVENT", title: "UI preserved export", description: "Test-only relationship fragnet.", cause: "employer", occurrenceDate: "2026-04-02", model: "relationship-fragnet", replacedRelationshipIds: ["50"],
  activities: [{ id: "FN-UI", name: "Injected delay", duration: 1, wbsId: "1000", calendarId: "10", kind: "fragnet" }],
  relationships: [{ id: "FREL-UI-1", predecessorId: "1", successorId: "FN-UI", type: "FS" }, { id: "FREL-UI-2", predecessorId: "FN-UI", successorId: "2", type: "FS" }],
};

const preservedSchedule: Schedule = {
  id: "ui-preserved", name: "UI-PRESERVE", startDate: "2026-04-01", calendar: { id: "xer-review-calendar", name: "P6 Calendar — review", workingWeekdays: [0, 1, 2, 3, 4, 5, 6], holidays: [], hoursPerDay: 8 },
  activities: [{ id: "1", name: "A100 — Start", duration: 2, wbsId: "1000", calendarId: "10" }, { id: "2", name: "A200 — Finish", duration: 2, wbsId: "1000", calendarId: "10" }],
  relationships: [{ id: "50", predecessorId: "1", successorId: "2", type: "FS" }], source: "xer", wbsNodes: [{ id: "1000", code: "1.0", name: "Main WBS", path: "Main WBS" }],
  xerSource: { rawText: preservedRawXer, originalFileName: "ui-original.xer", tableNames: ["PROJECT", "CALENDAR", "PROJWBS", "TASK", "TASKPRED"], projectId: "100", projectCalendarId: "10", calendarIds: ["10"], taskCalendarIds: ["10"], importedAt: "2026-04-01T00:00:00.000Z" },
};

describe("واجهة مقارنة التحديثات", () => {
  it("تستخدم الأساس وتحمل التحديث وتعرض الفروق وتصدر CSV من نفس التدفق", async () => {
    const user = userEvent.setup();
    const baseline = readExample("01-baseline-schedule.json");
    const updateText = readFileSync(resolve(process.cwd(), "examples", "02-update-after-foundation.json"), "utf8");
    const { container } = renderComparison(baseline);

    expect(screen.getByRole("heading", { name: "مقارنة تحديثات البرنامج · Schedule update comparison" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "استخدم البرنامج المفتوح كأساس · Use the open schedule as baseline" }));
    const updateFile = new File([updateText], "02-update-after-foundation.json", { type: "application/json" });
    Object.defineProperty(updateFile, "text", { value: async () => updateText });
    const inputs = container.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[1], { target: { files: [updateFile] } });

    await waitFor(() => expect(screen.getByTestId("gantt-comparison-chart")).toBeTruthy());
    expect(screen.getByText("المخطط الزمني المقارن")).toBeTruthy();
    expect(screen.getByText("مخطط زمني تفاعلي: الأساس والتحديث")).toBeTruthy();
    expect(screen.getByText("A200")).toBeTruthy();
    expect(screen.getAllByText("+3 يوم").length).toBeGreaterThan(0);
    expect(screen.getByText("فرق مدة المشروع · Project duration variance")).toBeTruthy();
    expect(screen.getByTestId("gantt-bar-baseline-A200")).toBeTruthy();
    expect(screen.getByTestId("gantt-bar-update-A200")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "مُعدّل" }));
    expect(screen.getByTestId("gantt-row-A200")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /تصدير CSV/ }));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("يعرض واجهة المقارنة بالـEnglish وLTR من دون تغيير معرف أو اسم نشاط المصدر", async () => {
    const user = userEvent.setup();
    const baseline = readExample("01-baseline-schedule.json");
    const updateText = readFileSync(resolve(process.cwd(), "examples", "02-update-after-foundation.json"), "utf8");
    const sourceActivity = baseline.activities.find(activity => activity.id === "A200");
    const { container } = renderComparison(baseline, "en");

    expect(screen.getByRole("heading", { name: "Schedule update comparison" })).toBeTruthy();
    expect(container.querySelector(".comparison-view")?.getAttribute("dir")).toBe("ltr");
    await user.click(screen.getByRole("button", { name: "Use the open schedule as baseline" }));
    const updateFile = new File([updateText], "02-update-after-foundation.json", { type: "application/json" });
    Object.defineProperty(updateFile, "text", { value: async () => updateText });
    fireEvent.change(container.querySelectorAll('input[type="file"]')[1], { target: { files: [updateFile] } });

    await waitFor(() => expect(screen.getByLabelText("Comparison timeline")).toBeTruthy());
    expect(screen.getByText("INTERACTIVE BASELINE / UPDATE TIMELINE")).toBeTruthy();
    expect(container.querySelector(".gantt-comparison-panel")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getAllByText("+3 days").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Changed" })).toBeTruthy();
    expect(screen.getByTestId("gantt-row-A200").textContent).toContain("A200");
    expect(screen.getByTestId("gantt-row-A200").textContent).toContain(sourceActivity?.name ?? "");
  });

  it("يصوغ إشعار تنزيل XER التجريبي بالـEnglish من دون ترجمة بيانات البرنامج", async () => {
    const baseline = readExample("01-baseline-schedule.json");
    renderComparison(baseline, "en");

    await userEvent.setup().click(screen.getByRole("button", { name: "Experimental XER fallback" }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringContaining("Experimental Pre-TIA XER was downloaded after round-trip import validation:"));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringContaining(" and "));
    expect(baseline.activities.find(activity => activity.id === "A200")?.name).toBe("صب الأساسات");
  });

  it("downloads original Pre, injected Post, and an event ZIP locally when the original XER and event are available", async () => {
    const user = userEvent.setup();
    renderComparison(preservedSchedule, "en", preservedEvent, [preservedEvent]);

    await user.click(screen.getByRole("button", { name: "Download original Pre — Event" }));
    await user.click(screen.getByRole("button", { name: "Download injected Post — Event" }));
    await user.click(screen.getByRole("button", { name: "Export Event Package ZIP" }));

    await waitFor(() => expect(downloadedNames).toEqual(expect.arrayContaining([
      "UI-PRESERVE--UI-EVENT--PRE-TIA.xer",
      "UI-PRESERVE--UI-EVENT--POST-TIA.xer",
      "UI-PRESERVE--EVENT-PACKAGE.zip",
    ])));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringContaining("original local XER"));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Local event package created.");
    expect(vi.mocked(toast.info)).toHaveBeenCalledWith(expect.stringContaining("Schedule/F9"));
  });
});
