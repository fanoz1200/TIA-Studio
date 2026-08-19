import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { insertFragnet, insertFragnets, runCPM, type Fragnet, type Schedule } from "./cpm";
import { importXerSchedule } from "./xer";

const examplePath = (name: string) => resolve(process.cwd(), "examples", name);

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
    const source = readFileSync(examplePath("04-minimal-p6-resource.xer"), "utf8");
    const { schedule, summary } = importXerSchedule(source, "04-minimal-p6-resource.xer");

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
