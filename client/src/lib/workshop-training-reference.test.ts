import { describe, expect, it } from "vitest";
import { WORKSHOP_NO8_TRAINING_REFERENCE } from "./workshop-training-reference";

describe("WORKSHOP_NO8_TRAINING_REFERENCE", () => {
  it("يحفظ الحقائق المشتقة فقط ولا يضيف مساراً أو رابطاً للملفات الأصلية", () => {
    expect(WORKSHOP_NO8_TRAINING_REFERENCE.baseline).toMatchObject({ activities: 9, relationships: 9, wbs: 3, calendars: 1 });
    expect(WORKSHOP_NO8_TRAINING_REFERENCE.postTia).toMatchObject({ activities: 13, relationships: 15, wbs: 3, calendars: 1 });
    expect(WORKSHOP_NO8_TRAINING_REFERENCE.localEngine.durationDeltaDays).toBe(17);
    expect(WORKSHOP_NO8_TRAINING_REFERENCE.calendarScope).toMatch(/لا يفك ترميز نمط تقويم P6/);
    expect(WORKSHOP_NO8_TRAINING_REFERENCE.manualP6Checks).toHaveLength(5);
    expect(WORKSHOP_NO8_TRAINING_REFERENCE.manualP6Checks.join(" ")).toMatch(/Schedule \(F9\)/);
    expect(Object.keys(WORKSHOP_NO8_TRAINING_REFERENCE).some(key => /url|path|file/i.test(key))).toBe(false);
  });
});
