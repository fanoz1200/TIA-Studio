// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { formatHomeChrome, formatHomeOverview, formatHomeStatus } from "./Home";

describe("formatHomeStatus", () => {
  it("renders fixed import status chrome in English without translating the supplied schedule name", () => {
    const scheduleName = "برنامج الأساسات — Update 04";

    expect(
      formatHomeStatus("en", "journeyImported", {
        stage: "Pre-event update",
        scheduleName,
      })
    ).toBe(`Read Pre-event update: ${scheduleName}`);
    expect(
      formatHomeStatus("en", "xerImported", {
        activities: 12,
        relationships: 15,
      })
    ).toBe(
      "XER imported: 12 activities and 15 relationships. Review the calendar before approval."
    );
  });

  it("keeps the Arabic fixed status version available for the same untouched source value", () => {
    const scheduleName = "برنامج الأساسات — Update 04";

    expect(
      formatHomeStatus("ar", "journeyImported", {
        stage: "تحديث قبل الحدث",
        scheduleName,
      })
    ).toBe(`تمت قراءة تحديث قبل الحدث: ${scheduleName}`);
  });
});

describe("formatHomeChrome", () => {
  it("provides English shell chrome while leaving source-derived values for callers to render unchanged", () => {
    const importedScheduleName = "برنامج الأساسات — Update 04";
    const chrome = formatHomeChrome("en");

    expect(chrome.workspaceSubtitle).toBe("Delay Analysis Workspace");
    expect(chrome.criticalPath).toBe("Critical path");
    expect(chrome.networkError).toBe("Unable to calculate the network");
    expect(importedScheduleName).toBe("برنامج الأساسات — Update 04");
  });

  it("retains Arabic shell chrome for the RTL interface", () => {
    const chrome = formatHomeChrome("ar");

    expect(chrome.workspaceSubtitle).toBe("مساحة عمل تحليل التأخيرات");
    expect(chrome.expectedCompletion).toBe("الإكمال المتوقع");
    expect(chrome.mainNavigation).toBe("التنقل الرئيسي");
  });
});

describe("formatHomeOverview", () => {
  it("provides English overview guidance while callers retain imported schedule values", () => {
    const importedScheduleName = "برنامج الأساسات — Update 04";
    const importedCalendarName = "تقويم المشروع — مصر (6 أيام)";
    const overview = formatHomeOverview("en");

    expect(overview.decisionCentre).toBe("Delay decision centre");
    expect(overview.modelNewEvent).toBe("Model a new event");
    expect(overview.qualityFooter).toContain("qualified professional");
    expect(importedScheduleName).toBe("برنامج الأساسات — Update 04");
    expect(importedCalendarName).toBe("تقويم المشروع — مصر (6 أيام)");
  });

  it("retains Arabic overview chrome for the RTL interface", () => {
    const overview = formatHomeOverview("ar");

    expect(overview.currentTechnicalImpact).toBe("الأثر الفني الحالي");
    expect(overview.analysisReadiness).toBe("جاهزية التحليل");
    expect(overview.noEventsYet).toBe("لا توجد أحداث بعد. أضف Fragnet للبدء.");
  });
});
