import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Schedule } from "@/lib/cpm";
import type { XerImportSummary } from "@/lib/xer";
import type { ScheduleSnapshot } from "./GuidedAnalysisPanel";
import { XerViewerPanel } from "./XerViewerPanel";

afterEach(() => cleanup());

const baseline: Schedule = {
  id: "base", name: "Baseline تجريبي", startDate: "2026-01-01", dataDate: "2026-01-10", source: "xer",
  calendar: { id: "eg", name: "مصر 6 أيام", workingWeekdays: [0, 1, 2, 3, 4, 6], holidays: [], hoursPerDay: 8 },
  activities: [{ id: "A100", name: "أساسات", duration: 5, wbs: "1.1", owner: "المقاول" }], relationships: [],
};
const updateRawXer = "%T\tPROJECT\n%F\tproj_id\n%R\tP1\n%E";
const update: Schedule = { ...baseline, id: "update", name: "Update تجريبي", dataDate: "2026-01-20", activities: [...baseline.activities, { id: "A200", name: "صب خرسانة", duration: 4, wbs: "1.2", owner: "المقاول" }], relationships: [{ id: "R1", predecessorId: "A100", successorId: "A200", type: "FS", lag: 0 }], xerSource: { rawText: updateRawXer, rawBytes: new TextEncoder().encode(updateRawXer), sourceEncoding: "utf-8", sourceByteLength: updateRawXer.length, preByteExact: true, originalFileName: "update.xer", tableNames: ["PROJECT", "CALENDAR"], projectId: "P1", projectCalendarId: "CAL-01", calendarIds: ["CAL-01"], taskCalendarIds: ["CAL-01"], importedAt: "2026-08-27T00:00:00.000Z" } };
const baselineSummary: XerImportSummary = { projectName: "Baseline", activitiesRead: 1, relationshipsRead: 0, wbsRead: 1, resourcesRead: 0, resourceAssignmentsRead: 0, assignmentsWithCosts: 0, activitiesWithProgress: 0, warnings: [], tablesFound: [] };
const updateSummary: XerImportSummary = { projectName: "Update", activitiesRead: 2, relationshipsRead: 1, wbsRead: 1, resourcesRead: 0, resourceAssignmentsRead: 0, assignmentsWithCosts: 0, activitiesWithProgress: 0, warnings: [], tablesFound: [] };
const baselineSnapshot: ScheduleSnapshot = { id: "snapshot-base", stage: "baseline", fileName: "baseline.xer", schedule: baseline, summary: baselineSummary };
const updateSnapshot: ScheduleSnapshot = { id: "snapshot-update", stage: "pre-event-update", fileName: "update.xer", schedule: update, summary: updateSummary };

function renderViewer(language: "ar" | "en", onNavigate = vi.fn()) {
  window.localStorage.setItem("tia-studio-interface-language", language);
  render(
    <LanguageProvider>
      <XerViewerPanel schedule={update} xerSummary={updateSummary} baselineSnapshot={baselineSnapshot} updateSnapshots={[updateSnapshot]} onNavigate={onNavigate} />
    </LanguageProvider>,
  );
  return onNavigate;
}

describe("عارض XER المحلي", () => {
  it("يعرض النسخ والفرق وحدود المراجعة ويربط العمل بالشاشات الحقيقية", () => {
    const onNavigate = renderViewer("ar");

    expect(screen.getByRole("heading", { name: "عارض XER والنسخ · XER and snapshot viewer" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "عارض XER والنسخ · XER and snapshot viewer" }).getAttribute("dir")).toBe("rtl");
    expect(screen.getByText(/الملف الأصلي محفوظ محلياً بايتياً داخل الجلسة/)).toBeTruthy();
    expect(screen.getByText(/مرجع P6/)).toBeTruthy();
    expect(screen.getAllByText("ساعات اليوم في P6 · P6 day hours").length).toBeGreaterThan(0);
    expect(screen.getAllByText("مطابقة Data Date · Data Date check").length).toBeGreaterThan(0);
    expect(screen.getByText("baseline.xer")).toBeTruthy();
    expect(screen.getByText("update.xer")).toBeTruthy();
    expect(screen.getByText("أنشطة أُضيفت · Activities added")).toBeTruthy();
    expect(screen.getAllByText("A200").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "افتح المقارنة · Open comparison" }));
    fireEvent.click(screen.getByRole("button", { name: "ارفع أو استبدل ملف · Upload or replace file" }));
    expect(onNavigate).toHaveBeenNthCalledWith(1, "compare");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "schedule");
  });

  it("يعرض عناصر واجهة English باتجاه LTR من دون ترجمة بيانات XER المستوردة", () => {
    renderViewer("en");

    const viewer = screen.getByRole("region", { name: "XER and snapshot viewer" });
    expect(viewer.getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("heading", { name: "XER and snapshot viewer" })).toBeTruthy();
    expect(screen.getByText("Viewer limits:")).toBeTruthy();
    expect(screen.getByText(/original file bytes are held locally for this session/)).toBeTruthy();
    expect(screen.getByText(/P6 verification required/)).toBeTruthy();
    expect(screen.getAllByText("P6 day hours").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Data Date check").length).toBeGreaterThan(0);
    expect(screen.getByText("Activities added")).toBeTruthy();
    expect(screen.getAllByText("A200").length).toBeGreaterThan(0);
    expect(screen.getByText("صب خرسانة")).toBeTruthy();
  });
});
