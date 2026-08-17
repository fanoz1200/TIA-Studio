import { describe, expect, it } from "vitest";
import { addWorkingDays, fiveDayCalendar, generateDelayAnalysisNarrative, runWindowTIA, type AnalysisWindow, type Fragnet, type Schedule } from "./cpm";
import { importXerSchedule } from "./xer";

const schedule: Schedule = {
  id: "window-schedule",
  name: "برنامج الاختبار الموسع",
  startDate: "2026-01-05",
  calendar: { ...fiveDayCalendar, holidays: ["2026-01-12"] },
  activities: [{ id: "A", name: "A", duration: 5 }, { id: "B", name: "B", duration: 5 }, { id: "C", name: "C", duration: 5 }],
  relationships: [{ id: "AB", predecessorId: "A", successorId: "B", type: "FS" }, { id: "BC", predecessorId: "B", successorId: "C", type: "FS" }],
};

const event = (id: string, title: string, date: string, cause: Fragnet["cause"], duration: number, replaced: string, predecessor: string, successor: string): Fragnet => ({
  id, title, description: `وصف ${title}`, cause, occurrenceDate: date,
  activities: [{ id: `${id}-A`, name: title, duration }], replacedRelationshipIds: [replaced],
  relationships: [{ id: `${id}-IN`, predecessorId: predecessor, successorId: `${id}-A`, type: "FS" }, { id: `${id}-OUT`, predecessorId: `${id}-A`, successorId: successor, type: "FS" }],
});

describe("التقويم والنوافذ والسرد", () => {
  it("يتخطى عطلة الأسبوع والعطل عند تحويل أيام العمل إلى تاريخ", () => {
    expect(addWorkingDays("2026-01-05", 5, schedule.calendar)).toBe("2026-01-13");
  });

  it("يجمع أحداث نافذة واحدة ويرصد مرشح التزامن الحرج", () => {
    const first = event("E1", "اعتماد", "2026-01-08", "employer", 2, "AB", "A", "B");
    const second = event("E2", "توريد", "2026-01-09", "contractor", 3, "BC", "B", "C");
    const window: AnalysisWindow = { id: "W1", name: "نافذة يناير", from: "2026-01-01", to: "2026-01-31", scheduleId: schedule.id, status: "review" };
    const result = runWindowTIA(schedule, window, [second, first]);
    expect(result.events.map((item) => item.id)).toEqual(["E1", "E2"]);
    expect(result.totalImpactDays).toBe(5);
    expect(result.concurrentFindings[0]?.classification).toBe("critical-concurrency-candidate");
  });

  it("ينشئ سرداً تقنياً يصرح بالمنهجية والتحفظات", () => {
    const one = event("E1", "اعتماد", "2026-01-08", "employer", 2, "AB", "A", "B");
    const result = runWindowTIA(schedule, { id: "W1", name: "يناير", from: "2026-01-01", to: "2026-01-31", scheduleId: schedule.id, status: "review" }, [one]);
    const narrative = generateDelayAnalysisNarrative({ schedule, result, context: { analyst: "المحلل", evidenceSummary: "مراسلات وتحديثات" } });
    expect(narrative).toContain("تحليل TIA مجمّع");
    expect(narrative).toContain("مسودة فنية قابلة للتحرير");
  });
});

describe("مستورد XER المحلي", () => {
  it("يقرأ جداول المشروع والأنشطة والعلاقات ويحول الساعات إلى أيام", () => {
    const xer = `%T\tPROJECT\n%F\tproj_id\tproj_short_name\tplan_start_date\tdata_date\n%R\t1\tP6-DEMO\t2026-01-05 08:00\t2026-01-10 08:00\n%E\n%T\tTASK\n%F\ttask_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tearly_start_date\n%R\t10\tA100\tMobilization\t40\t2026-01-05 08:00\n%R\t20\tA200\tFoundation\t64\t2026-01-12 08:00\n%E\n%T\tTASKPRED\n%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\n%R\t100\t20\t10\tPR_FS\t0\n%E\n%T\tCALENDAR\n%F\tclndr_id\tclndr_name\n%R\t1\tStandard 5 Day\n%E`;
    const result = importXerSchedule(xer, "demo.xer");
    expect(result.schedule.name).toBe("P6-DEMO");
    expect(result.schedule.activities[1].duration).toBe(8);
    expect(result.schedule.relationships[0]).toMatchObject({ predecessorId: "10", successorId: "20", type: "FS" });
    expect(result.summary.calendarName).toBe("Standard 5 Day");
  });
});
