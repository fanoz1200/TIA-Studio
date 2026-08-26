import { describe, expect, it } from "vitest";
import { calendarDayCalendar, runTimeSliceWindowAnalysis, type Schedule, type TimeSliceWindow } from "./cpm";

const before: Schedule = {
  id: "PRJ-001",
  name: "Update 01",
  startDate: "2026-01-01",
  dataDate: "2026-01-10",
  calendar: calendarDayCalendar,
  activities: [
    { id: "A", name: "Start", duration: 2 },
    { id: "B", name: "Finish", duration: 3 },
  ],
  relationships: [{ id: "AB", predecessorId: "A", successorId: "B", type: "FS" }],
};

const after: Schedule = {
  ...before,
  name: "Update 02",
  dataDate: "2026-01-20",
  activities: [
    { id: "A", name: "Start", duration: 2 },
    { id: "B", name: "Finish", duration: 5 },
    { id: "C", name: "Added scope", duration: 1 },
  ],
  relationships: [
    { id: "AB", predecessorId: "A", successorId: "B", type: "FS" },
    { id: "BC", predecessorId: "B", successorId: "C", type: "FS" },
  ],
};

const window: TimeSliceWindow = {
  id: "TS-01",
  name: "January status window",
  fromSnapshot: { id: "S-01", label: "Update 01", fileName: "update-01.xer", schedule: before },
  toSnapshot: { id: "S-02", label: "Update 02", fileName: "update-02.xer", schedule: after },
  status: "review",
};

describe("runTimeSliceWindowAnalysis", () => {
  it("يرصد فرق الإكمال والتغيرات من نسختين من دون إدراج Fragnet", () => {
    const result = runTimeSliceWindowAnalysis(window);
    expect(result.method).toBe("time-slice-observational");
    expect(result.completionShiftCalendarDays).toBe(3);
    expect(result.completionShiftWorkingDays).toBe(3);
    expect(result.activityChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ activityId: "B", change: "duration-changed", fromDuration: 3, toDuration: 5 }),
      expect.objectContaining({ activityId: "C", change: "added", toDuration: 1 }),
    ]));
    expect(result.warnings.join(" ")).toContain("ليست قياس TIA");
  });

  it("يرفض ترتيب snapshots العكسي", () => {
    expect(() => runTimeSliceWindowAnalysis({ ...window, fromSnapshot: window.toSnapshot, toSnapshot: window.fromSnapshot })).toThrow("يجب أن يسبق");
  });
});

