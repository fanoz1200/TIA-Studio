// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { Schedule } from "@/lib/cpm";
import { APP_LANGUAGE_STORAGE_KEY, LanguageProvider } from "@/contexts/LanguageContext";
import { ScheduleComparisonPanel } from "./ScheduleComparisonPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const readExample = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), "examples", name), "utf8")) as Schedule;
let clickSpy: ReturnType<typeof vi.spyOn>;
let createObjectUrlSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  createObjectUrlSpy = vi.fn(() => "blob:comparison-result");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlSpy });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function renderComparison(currentSchedule: Schedule, language: "ar" | "en" = "ar") {
  localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  return render(<LanguageProvider><ScheduleComparisonPanel currentSchedule={currentSchedule} /></LanguageProvider>);
}

describe("واجهة مقارنة التحديثات", () => {
  it("تستخدم الأساس وتحمل التحديث وتعرض الفروق وتصدر CSV من نفس التدفق", async () => {
    const user = userEvent.setup();
    const baseline = readExample("01-baseline-schedule.json");
    const updateText = readFileSync(resolve(process.cwd(), "examples", "02-update-after-foundation.json"), "utf8");
    const { container } = renderComparison(baseline);

    await user.click(screen.getByRole("button", { name: /استخدم البرنامج المفتوح كأساس/ }));
    const updateFile = new File([updateText], "02-update-after-foundation.json", { type: "application/json" });
    Object.defineProperty(updateFile, "text", { value: async () => updateText });
    const inputs = container.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[1], { target: { files: [updateFile] } });

    await waitFor(() => expect(screen.getByTestId("gantt-comparison-chart")).toBeTruthy());
    expect(screen.getByText("المخطط الزمني المقارن")).toBeTruthy();
    expect(screen.getByText("A200")).toBeTruthy();
    expect(screen.getAllByText("+3 يوم").length).toBeGreaterThan(0);
    expect(screen.getByText(/فرق مدة المشروع/)).toBeTruthy();
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
    expect(container.querySelector(".gantt-comparison-panel")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getAllByText("+3 days").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Changed" })).toBeTruthy();
    expect(screen.getByTestId("gantt-row-A200").textContent).toContain("A200");
    expect(screen.getByTestId("gantt-row-A200").textContent).toContain(sourceActivity?.name ?? "");
  });

  it("يصوغ إشعار تنزيل XER التجريبي بالـEnglish من دون ترجمة بيانات البرنامج", async () => {
    const baseline = readExample("01-baseline-schedule.json");
    renderComparison(baseline, "en");

    await userEvent.setup().click(screen.getByRole("button", { name: "Download Pre-TIA XER" }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringContaining("Experimental Pre-TIA XER was downloaded after round-trip import validation:"));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringContaining(" and "));
    expect(baseline.activities.find(activity => activity.id === "A200")?.name).toBe("صب الأساسات");
  });
});
