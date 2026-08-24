import { describe, expect, it } from "vitest";
import { calculateCalendarDeadline } from "./claimConsole";

describe("Claim Console deadline calculation", () => {
  it("يحسب فقط عدد الأيام التقويمية الذي أدخله المستخدم، من دون قاعدة عقدية ضمنية", () => {
    expect(calculateCalendarDeadline("2026-01-31", 2)).toBe("2026-02-02");
    expect(calculateCalendarDeadline("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("يرفض التاريخ أو المدة غير الصالحة بدلاً من إنشاء موعد افتراضي", () => {
    expect(() => calculateCalendarDeadline("31-01-2026", 7)).toThrow(/YYYY-MM-DD/);
    expect(() => calculateCalendarDeadline("2026-01-31", -1)).toThrow(/0 و36500/);
    expect(() => calculateCalendarDeadline("2026-01-31", 1.5)).toThrow(/عدداً صحيحاً/);
  });
});
