import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Schedule } from "./cpm";
import { compareScheduleUpdates, comparisonToCsv } from "./schedule-comparison";

const example = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), "examples", name), "utf8")) as Schedule;

describe("مقارنة تحديثات البرنامج", () => {
  it("يكشف فروق المدة والأنشطة المعدلة بين برنامج الأساس والتحديث", () => {
    const comparison = compareScheduleUpdates(example("01-baseline-schedule.json"), example("02-update-after-foundation.json"));

    expect(comparison.completionDeltaDays).toBeGreaterThan(0);
    expect(comparison.summary.changed).toBeGreaterThan(0);
    expect(comparison.activityVariances.find(item => item.id === "A200")).toMatchObject({ status: "changed", durationDelta: 3 });
  });

  it("يصدر ملف CSV يتضمن رؤوس الأعمدة والنشاط المتغير", () => {
    const comparison = compareScheduleUpdates(example("01-baseline-schedule.json"), example("02-update-after-foundation.json"));
    const csv = comparisonToCsv(comparison);

    expect(csv).toContain('"معرف النشاط"');
    expect(csv).toContain('"A200"');
    expect(csv).toContain('"changed"');
  });
});
