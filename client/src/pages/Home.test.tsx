// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  formatAnalysisReportCopy,
  formatEventWorkspaceCopy,
  filterAffectedActivities,
  formatHomeChrome,
  formatHomeOverview,
  formatHomeStatus,
  formatScheduleWorkspaceCopy,
} from "./Home";

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

describe("filterAffectedActivities", () => {
  const activities = [
    { id: "A200", name: "Structural frame", duration: 10, wbs: "Tower / Structure", wbsId: "WBS-STR" },
    { id: "B310", name: "MEP rough-in", duration: 7, wbs: "Tower / Services", wbsId: "WBS-MEP" },
  ];

  it("filters locally by untouched ID, name, or WBS and keeps an empty search unfiltered", () => {
    expect(filterAffectedActivities(activities, "a200").map((activity) => activity.id)).toEqual(["A200"]);
    expect(filterAffectedActivities(activities, "rough-in").map((activity) => activity.id)).toEqual(["B310"]);
    expect(filterAffectedActivities(activities, "wbs-str").map((activity) => activity.id)).toEqual(["A200"]);
    expect(filterAffectedActivities(activities, "")).toBe(activities);
    expect(activities[0]?.name).toBe("Structural frame");
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

describe("formatScheduleWorkspaceCopy", () => {
  it("provides English import and calendar chrome while callers retain XER and calendar source values", () => {
    const importedProjectName = "برنامج الأساسات — Update 04";
    const importedCalendarName = "تقويم المشروع — مصر (6 أيام)";
    const copy = formatScheduleWorkspaceCopy("en");

    expect(copy.scheduleHeading).toBe("Baseline schedule and calendar");
    expect(copy.xerChoose).toBe("Choose XER");
    expect(copy.workingCalendar).toBe("WORKING CALENDAR");
    expect(copy.holidayReviewRequired).toContain("movable holidays");
    expect(importedProjectName).toBe("برنامج الأساسات — Update 04");
    expect(importedCalendarName).toBe("تقويم المشروع — مصر (6 أيام)");
  });

  it("retains Arabic import and calendar chrome for the RTL interface", () => {
    const copy = formatScheduleWorkspaceCopy("ar");

    expect(copy.scheduleHeading).toBe("البرنامج المرجعي والتقويم");
    expect(copy.updateHolidays).toBe("تحديث الإجازات");
    expect(copy.noExceptionalHolidays).toBe("لا توجد عطل استثنائية مدخلة.");
  });
});

describe("formatEventWorkspaceCopy", () => {
  it("provides English event and Fragnet chrome while callers retain event and schedule source values", () => {
    const eventTitle = "تأخر اعتماد المخططات — RFI-17";
    const activityId = "A200";
    const calendarName = "تقويم المشروع — مصر (6 أيام)";
    const copy = formatEventWorkspaceCopy("en");

    expect(copy.heading).toBe("Add a delay event as a Fragnet");
    expect(copy.approveAndRun).toBe("Approve model and run TIA");
    expect(copy.eventUsesCalendar(calendarName)).toContain(calendarName);
    expect(eventTitle).toBe("تأخر اعتماد المخططات — RFI-17");
    expect(activityId).toBe("A200");
  });

  it("retains Arabic event and Fragnet chrome for the RTL interface", () => {
    const copy = formatEventWorkspaceCopy("ar");

    expect(copy.heading).toBe("أضف حدث تأخير كـ Fragnet");
    expect(copy.approveAndRun).toBe("اعتماد النموذج وتشغيل TIA");
    expect(copy.selectActivityPreview).toBe("اختر نشاطاً متأثراً لمعاينة التقسيم");
  });
});

describe("formatAnalysisReportCopy", () => {
  it("provides English analysis and report chrome without translating source-derived result values", () => {
    const scheduleName = "برنامج الأساسات — Update 04";
    const eventTitle = "تأخر اعتماد المخططات — RFI-17";
    const calendarName = "تقويم المشروع — مصر (6 أيام)";
    const activityId = "A200";
    const impactValue = "+6";
    const copy = formatAnalysisReportCopy("en");

    expect(copy.analysisHeading).toBe("Traceable analysis result");
    expect(copy.downloadRecord).toBe("Download record");
    expect(copy.completionUsesCalendar(calendarName)).toContain(calendarName);
    expect(scheduleName).toBe("برنامج الأساسات — Update 04");
    expect(eventTitle).toBe("تأخر اعتماد المخططات — RFI-17");
    expect(activityId).toBe("A200");
    expect(impactValue).toBe("+6");
  });

  it("retains Arabic analysis and report chrome while keeping professional limitations explicit", () => {
    const copy = formatAnalysisReportCopy("ar");

    expect(copy.analysisHeading).toBe("نتيجة تحليل قابلة للتتبع");
    expect(copy.printReport).toBe("طباعة التقرير");
    expect(copy.methodologyText).toContain("لا يحسم الاستحقاق التعاقدي");
  });
});
