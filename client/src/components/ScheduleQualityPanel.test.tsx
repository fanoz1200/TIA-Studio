import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Schedule } from "@/lib/cpm";
import { ScheduleQualityPanel } from "./ScheduleQualityPanel";

const schedule: Schedule = {
  id: "quality-language-test",
  name: "برنامج اختبار الجودة",
  startDate: "2026-01-01",
  calendar: { id: "cal", name: "تقويم اختبار", workingWeekdays: [0, 1, 2, 3, 4], holidays: [], hoursPerDay: 8 },
  activities: [
    { id: "A100", name: "أعمال الأساس", duration: 5, wbsId: "W1" },
    { id: "B100", name: "أعمال لاحقة", duration: 4, wbsId: "W1" },
  ],
  relationships: [{ id: "R1", predecessorId: "A100", successorId: "B100", type: "FS", lag: 0 }],
  wbsNodes: [{ id: "W1", code: "1", name: "أعمال اختبار", path: "1" }],
  resourceAssignments: [],
  xerSource: { rawText: "%T\tPROJECT\n%F\tproj_id\n%R\tP1\n%E", originalFileName: "quality-source.xer", tableNames: ["PROJECT"], projectId: "P1", projectCalendarId: "CAL-01", calendarIds: ["CAL-01"], taskCalendarIds: ["CAL-01"], importedAt: "2026-08-27T00:00:00.000Z" },
};

function renderPanel(language: "ar" | "en") {
  window.localStorage.setItem("tia-studio-interface-language", language);
  return render(
    <LanguageProvider>
      <ScheduleQualityPanel view="quality" schedule={schedule} onNavigate={vi.fn()} />
    </LanguageProvider>,
  );
}

describe("بوابة جودة الجدول الثنائية", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("تعرض العناوين العربية واتجاه RTL افتراضياً", () => {
    const { container } = renderPanel("ar");
    expect(container.querySelector(".view-stack")?.getAttribute("dir")).toBe("rtl");
    expect(screen.getByText(/بوابة جودة البرنامج وسجل التحسين.*Schedule quality gate and improvement ledger/)).toBeTruthy();
    expect(screen.getByText(/قواعد الفحص القابلة للتفسير.*Explainable review rules/)).toBeTruthy();
  });

  it("تعرض عناصر البوابة المشتركة بالإنجليزية واتجاه LTR", () => {
    const { container } = renderPanel("en");
    expect(container.querySelector(".view-stack")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("Schedule quality gate and improvement ledger")).toBeTruthy();
    expect(screen.getByText("Explainable review rules")).toBeTruthy();
    expect(screen.getByText("XER export decision")).toBeTruthy();
    expect(screen.getByText("Preserved XER path")).toBeTruthy();
    expect(screen.getByText(/Pre returns the original bytes/)).toBeTruthy();
    expect(screen.getByText(/does not decode clndr_data/)).toBeTruthy();
  });
});
