import { describe, expect, it, vi } from "vitest";
import {
  findRegionalCalendarCountry,
  loadPublicHolidays,
  regionalCalendarForCountry,
} from "./regional-calendar";

describe("التقويم الإقليمي", () => {
  it("يبدأ تقويم مصر بستة أيام عمل من السبت إلى الخميس", () => {
    const egypt = findRegionalCalendarCountry("EG");
    expect(egypt?.workingWeekdays).toEqual([0, 1, 2, 3, 4, 6]);

    const calendar = regionalCalendarForCountry(egypt!);
    expect(calendar.countryCode).toBe("EG");
    expect(calendar.holidayReviewRequired).toBe(true);
    expect(calendar.holidaySource).toContain("لم يُحدّث");
  });

  it("يقرأ قائمة الإجازات من المصدر عند طلب المستخدم ويحتفظ باسمها", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { date: "2026-04-20", localName: "عيد الفطر", name: "Eid al-Fitr" },
        { date: "غير صالح", name: "Skip" },
      ],
    });

    await expect(loadPublicHolidays("EG", 2026, request)).resolves.toEqual([
      { date: "2026-04-20", label: "عيد الفطر" },
    ]);
    expect(request).toHaveBeenCalledWith(
      "https://date.nager.at/api/v3/PublicHolidays/2026/EG"
    );
  });
});
