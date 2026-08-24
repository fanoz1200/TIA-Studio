import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildAnalysisWorkbook } from "./analysis-excel";
import { insertFragnet, runCPM, type Fragnet, type Schedule, type TiaResult } from "./cpm";
import { assessScheduleQuality } from "./schedule-quality";

const examplePath = (name: string) => resolve(process.cwd(), "examples", name);

describe("ملف Excel التحليلي", () => {
  it("ينشئ ملخصاً وأوراق الأنشطة والعلاقات والجودة", () => {
    const schedule = JSON.parse(readFileSync(examplePath("05-training-tia-baseline.json"), "utf8")) as Schedule;
    const event = JSON.parse(readFileSync(examplePath("06-training-tia-event.json"), "utf8")) as Fragnet;
    const baseline = runCPM(schedule);
    const impacted = runCPM(insertFragnet(schedule, event));
    const analysis: TiaResult = {
      fragnetId: event.id, fragnetTitle: event.title, baseline, impacted,
      impactDays: impacted.projectDuration - baseline.projectDuration,
      baselineCompletionDate: baseline.completionDate, impactedCompletionDate: impacted.completionDate,
      outcome: "delayed", notes: ["بيانات تدريب مصطنعة"],
    };
    const book = buildAnalysisWorkbook({ schedule, quality: assessScheduleQuality(schedule), analysis, events: [event], narrative: "سرد تدريبي" });
    expect(book.SheetNames).toEqual(expect.arrayContaining(["الملخص", "الأنشطة", "العلاقات", "الأحداث", "فحص الجودة"]));
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets["الملخص"], { header: 1 });
    expect(JSON.stringify(rows)).toContain("الأثر المحسوب");
  });

  it("creates English worksheet names and headers when English is selected", () => {
    const schedule = JSON.parse(readFileSync(examplePath("05-training-tia-baseline.json"), "utf8")) as Schedule;
    const event = JSON.parse(readFileSync(examplePath("06-training-tia-event.json"), "utf8")) as Fragnet;
    const baseline = runCPM(schedule);
    const impacted = runCPM(insertFragnet(schedule, event));
    const analysis: TiaResult = {
      fragnetId: event.id, fragnetTitle: event.title, baseline, impacted,
      impactDays: impacted.projectDuration - baseline.projectDuration,
      baselineCompletionDate: baseline.completionDate, impactedCompletionDate: impacted.completionDate,
      outcome: "delayed", notes: ["Synthetic training data"],
    };
    const book = buildAnalysisWorkbook({ schedule, quality: assessScheduleQuality(schedule), analysis, events: [event], narrative: "Training narrative", language: "en" });
    expect(book.SheetNames).toEqual(expect.arrayContaining(["Summary", "Activities", "Relationships", "Events", "Quality gate"]));
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Summary, { header: 1 });
    expect(JSON.stringify(rows)).toContain("Calculated impact");
  });
});
