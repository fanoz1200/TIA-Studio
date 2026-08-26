import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { insertFragnet, insertFragnets, runCPM, type Fragnet, type Schedule } from "./cpm";
import { importXerSchedule } from "./xer";

const examplePath = (name: string) => resolve(process.cwd(), "examples", name);

const minimalResourceXerFixture = `%T\tPROJECT
%F\tproj_short_name\tplan_start_date
%R\tمشروع تدريب موارد\t2026-03-01
%E
%T\tTASK
%F\ttask_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\twbs_id\tearly_start_date
%R\tT-100\tA100\tأعمال الأساسات\t80\t40\tW-01\t2026-03-01
%E
%T\tRSRC
%F\trsrc_id\trsrc_name\trsrc_type
%R\tR-EXC\tحفار\tNonLabor
%E
%T\tTASKRSRC
%F\ttaskrsrc_id\ttask_id\trsrc_id\trsrc_type\ttarget_cost\tremain_cost\tact_reg_cost\tact_ot_cost\ttarget_qty\tremain_qty\tcost_per_qty\tremain_qty_per_hr\tacct_id\twbs_id
%R\tTR-01\tT-100\tR-EXC\tNonLabor\t5000\t2500\t1000\t200\t100\t50\t50\t1\tAC-01\tW-01
%E
`;

describe("مثالات التدريب", () => {
  it("يشغل برنامج الأساس JSON في محرك CPM", () => {
    const schedule = JSON.parse(readFileSync(examplePath("01-baseline-schedule.json"), "utf8")) as Schedule;
    const result = runCPM(schedule);

    expect(schedule.activities).toHaveLength(4);
    expect(schedule.relationships).toHaveLength(3);
    expect(schedule.resourceAssignments).toHaveLength(3);
    expect(result.projectDuration).toBeGreaterThan(0);
    expect(result.completionDate).toMatch(/^2026-\d{2}-\d{2}$/);
    expect(result.activities.filter(activity => activity.totalFloat === 0)).toHaveLength(4);
  });

  it("يقرأ ملف XER المصغر مورد TASKRSRC وتكلفته", () => {
    const { schedule, summary } = importXerSchedule(minimalResourceXerFixture, "training-resource-fixture");

    expect(summary.resourceAssignmentsRead).toBe(1);
    expect(schedule.resourceAssignments?.[0]).toMatchObject({
      activityId: "T-100",
      resourceName: "حفار",
      resourceType: "nonlabor",
      targetCost: 5000,
    });
  });

  it("يتحقق من أثر Fragnet تدريبي على مسار حرج واحد من دون ادعاء استحقاق", () => {
    const baseline = JSON.parse(readFileSync(examplePath("05-training-tia-baseline.json"), "utf8")) as Schedule;
    const event = JSON.parse(readFileSync(examplePath("06-training-tia-event.json"), "utf8")) as Fragnet;

    const before = runCPM(baseline);
    const after = runCPM(insertFragnet(baseline, event));

    expect(before.projectDuration).toBe(17);
    expect(after.projectDuration).toBe(21);
    expect(after.projectDuration - before.projectDuration).toBe(4);
    expect(after.criticalActivityIds).toContain("FT100");
  });

  it("يثبت أن الحدثين المتزامنين في مسارين حرجين لا يجمعان آلياً كأثر زمني", () => {
    const baseline = JSON.parse(readFileSync(examplePath("07-training-concurrency-baseline.json"), "utf8")) as Schedule;
    const payload = JSON.parse(readFileSync(examplePath("08-training-concurrency-events.json"), "utf8")) as { events: Fragnet[] };

    const before = runCPM(baseline);
    const after = runCPM(insertFragnets(baseline, payload.events));

    expect(before.projectDuration).toBe(14);
    expect(after.projectDuration).toBe(17);
    expect(after.projectDuration - before.projectDuration).toBe(3);
    expect(after.criticalActivityIds).toEqual(expect.arrayContaining(["FCE100", "FCC100"]));
  });
});
