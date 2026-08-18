import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runCPM, type Schedule } from "./cpm";
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
});
