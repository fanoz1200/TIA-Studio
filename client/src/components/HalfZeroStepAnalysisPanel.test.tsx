import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { APP_LANGUAGE_STORAGE_KEY, LanguageProvider } from "@/contexts/LanguageContext";
import { calendarDayCalendar, type Schedule } from "@/lib/cpm";
import type { ScheduleSnapshot } from "./GuidedAnalysisPanel";
import { HalfZeroStepAnalysisPanel } from "./HalfZeroStepAnalysisPanel";

const previousSchedule: Schedule = {
  id: "HZ-UI",
  name: "Half Zero UI Fixture",
  startDate: "2026-01-01",
  dataDate: "2026-01-31",
  calendar: calendarDayCalendar,
  activities: [
    { id: "A-100", name: "Progressed activity", duration: 10, percentComplete: 20, actualStart: "2026-01-03", remainingDuration: 8 },
    { id: "A-200", name: "Revised activity", duration: 5, percentComplete: 0 },
  ],
  relationships: [{ id: "R-1", predecessorId: "A-100", successorId: "A-200", type: "FS" }],
};

const currentSchedule: Schedule = {
  ...previousSchedule,
  dataDate: "2026-02-28",
  activities: [
    { ...previousSchedule.activities[0], percentComplete: 70, remainingDuration: 3 },
    { ...previousSchedule.activities[1], duration: 8 },
  ],
};

const baseline: ScheduleSnapshot = { id: "BASE-HZ", stage: "baseline", fileName: "Baseline HalfZero.xer", schedule: previousSchedule };
const update: ScheduleSnapshot = { id: "UPD-HZ", stage: "later-update", fileName: "Current HalfZero.xer", schedule: currentSchedule };

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderPanel(language: "ar" | "en", initialBaseline: ScheduleSnapshot | null, updates: ScheduleSnapshot[]) {
  localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  return render(<LanguageProvider><HalfZeroStepAnalysisPanel baselineSnapshot={initialBaseline} updateSnapshots={updates} /></LanguageProvider>);
}

describe("Half–Zero Step analysis panel", () => {
  it("يشرح أن زوجاً متتابعاً من النسخ مطلوب قبل بدء المراجعة", () => {
    const { container } = renderPanel("ar", baseline, []);
    expect(container.querySelector("[data-testid='half-zero-step-panel']")?.textContent).toContain("تحليل Half–Zero Step · مراجعة فقط");
    expect(screen.getByText(/يلزم اختيار نسختين متتابعتين محفوظتين/)).toBeTruthy();
  });

  it("يعرض ملفي المصدر وبوابة الجاهزية ويطلب تصنيف المحلل بدلاً من توزيع تلقائي", () => {
    renderPanel("ar", baseline, [update]);
    expect(screen.getByText(/Baseline HalfZero\.xer/)).toBeTruthy();
    expect(screen.getByText(/Current HalfZero\.xer/)).toBeTruthy();
    expect(screen.getByText(/بوابة الجاهزية/)).toBeTruthy();
    expect(screen.getByText(/تأكيد محلل مطلوب قبل التوزيع/)).toBeTruthy();
    expect(screen.getByText(/لم يُنتج توزيع Half–Zero/)).toBeTruthy();
  });

  it("يعرض الغلاف بالإنجليزية واتجاه LTR مع الاحتفاظ بأسماء ملفات المصدر", () => {
    const { container } = renderPanel("en", baseline, [update]);
    expect(screen.getByRole("heading", { name: "Half–Zero Step Analysis · Review only" })).toBeTruthy();
    expect(container.querySelector("[data-testid='half-zero-step-panel']")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText(/Baseline HalfZero\.xer/)).toBeTruthy();
  });
});
