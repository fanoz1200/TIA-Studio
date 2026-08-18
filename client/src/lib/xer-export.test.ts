import { describe, expect, it } from "vitest";
import { runCPM, type Schedule } from "./cpm";
import { exportExperimentalXer } from "./xer-export";
import { importXerSchedule } from "./xer";

const schedule: Schedule = {
  id: "xer-export-test",
  name: "مشروع اختبار XER",
  startDate: "2026-04-01",
  dataDate: "2026-04-02",
  calendar: { id: "test-cal", name: "تقويم اختبار", workingWeekdays: [0, 1, 2, 3, 4, 5, 6], holidays: [], hoursPerDay: 8 },
  wbsNodes: [{ id: "W-01", code: "1.1", name: "الأعمال", path: "الأعمال" }],
  activities: [
    { id: "A100", name: "بداية", duration: 2, wbsId: "W-01", percentComplete: 25, percentCompleteType: "physical" },
    { id: "A200", name: "تنفيذ", duration: 3, wbsId: "W-01" },
  ],
  relationships: [{ id: "R-1", predecessorId: "A100", successorId: "A200", type: "FS", lag: 1 }],
};

describe("experimental XER export", () => {
  it("writes the declared interchange tables and round-trips activity and relationship counts", () => {
    const result = exportExperimentalXer(schedule, "post-tia");
    const imported = importXerSchedule(result.content, result.fileName);
    expect(result.fileName).toContain("POST-TIA.xer");
    expect(result.content).toContain("%T\tPROJECT");
    expect(result.content).toContain("%T\tTASKPRED");
    expect(imported.summary).toMatchObject({ activitiesRead: 2, relationshipsRead: 1, wbsRead: 1 });
    expect(imported.schedule.activities.map((activity) => activity.name)).toEqual(expect.arrayContaining(["A100 — بداية", "A200 — تنفيذ"]));
    expect(imported.schedule.relationships[0]).toMatchObject({ type: "FS", lag: 1 });
    expect(runCPM(imported.schedule).projectDuration).toBe(runCPM(schedule).projectDuration);
  });

  it("states the missing P6 scopes rather than silently claiming full fidelity", () => {
    const result = exportExperimentalXer(schedule);
    expect(result.warnings.join(" ")).toContain("الموارد");
    expect(result.warnings.join(" ")).toContain("لا يستبدل ملف P6 المصدر");
  });
});
