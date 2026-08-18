// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Schedule } from "@/lib/cpm";
import { ScheduleComparisonPanel } from "./ScheduleComparisonPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

afterEach(() => vi.restoreAllMocks());

describe("واجهة مقارنة التحديثات", () => {
  it("تستخدم الأساس وتحمل التحديث وتعرض الفروق وتصدر CSV من نفس التدفق", async () => {
    const user = userEvent.setup();
    const baseline = readExample("01-baseline-schedule.json");
    const updateText = readFileSync(resolve(process.cwd(), "examples", "02-update-after-foundation.json"), "utf8");
    const { container } = render(<ScheduleComparisonPanel currentSchedule={baseline} />);

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
});
