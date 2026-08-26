// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { APP_LANGUAGE_STORAGE_KEY, LanguageProvider } from "@/contexts/LanguageContext";
import { calendarDayCalendar, type Schedule } from "@/lib/cpm";
import type { ScheduleSnapshot } from "./GuidedAnalysisPanel";
import { TimeSliceWindowAnalysisPanel } from "./TimeSliceWindowAnalysisPanel";

const earlier: Schedule = {
  id: "PRJ-WA",
  name: "Programme update 01",
  startDate: "2026-01-01",
  dataDate: "2026-01-10",
  calendar: calendarDayCalendar,
  activities: [{ id: "A-100", name: "Source activity name", duration: 3 }],
  relationships: [],
};

const later: Schedule = { ...earlier, dataDate: "2026-01-20", activities: [{ id: "A-100", name: "Source activity name", duration: 5 }] };

const baseline: ScheduleSnapshot = { id: "BASE", stage: "baseline", fileName: "Baseline Source.xer", schedule: earlier };
const update: ScheduleSnapshot = { id: "UPD-01", stage: "later-update", fileName: "Update Source.xer", schedule: later };

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderPanel(language: "ar" | "en", baselineSnapshot: ScheduleSnapshot | null, updateSnapshots: ScheduleSnapshot[]) {
  localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  return render(<LanguageProvider><TimeSliceWindowAnalysisPanel baselineSnapshot={baselineSnapshot} updateSnapshots={updateSnapshots} /></LanguageProvider>);
}

describe("Time Slice Window Analysis panel", () => {
  it("يوضح أن نسختين متتاليتين مطلوبتان قبل تشغيل القراءة الرصدية", () => {
    const { container } = renderPanel("ar", baseline, []);
    expect(container.querySelector("[data-testid='time-slice-window-panel']")?.textContent).toContain("تحليل النوافذ الرصدي · Time Slice Window Analysis");
    expect(screen.getByText(/يلزم Baseline وUpdate واحد/)).toBeTruthy();
  });

  it("يعرض الفرق المحلي ويحافظ على أسماء ملفات المصدر كما وردت", () => {
    renderPanel("ar", baseline, [update]);
    expect(screen.getByText(/Baseline Source\.xer/)).toBeTruthy();
    expect(screen.getByText(/Update Source\.xer/)).toBeTruthy();
    expect(screen.getAllByText("+2 d").length).toBeGreaterThan(0);
    expect(screen.getByText("A-100")).toBeTruthy();
  });

  it("يعرض Chrome باللغة الإنجليزية فقط مع الاحتفاظ باسم الملف المصدر", () => {
    const { container } = renderPanel("en", baseline, [update]);
    expect(screen.getByRole("heading", { name: "Time Slice Window Analysis" })).toBeTruthy();
    expect(container.querySelector("[data-testid='time-slice-window-panel']")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText(/Baseline Source\.xer/)).toBeTruthy();
  });
});
