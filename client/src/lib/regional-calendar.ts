import type { WorkingCalendar } from "./cpm";

export type RegionalCalendarCountry = {
  code: string;
  label: string;
  holidayCountryCode: string;
  workingWeekdays: number[];
  defaultHoursPerDay: number;
};

/**
 * الأيام مرتبة على JavaScript Date: الأحد 0 حتى السبت 6.
 * لا تدخل قائمة الإجازات الدينية المتغيرة هنا كتواريخ مفترضة؛ تُحمّل كمصدر خارجي
 * وتبقى ظاهرة للمراجع قبل اعتمادها في حساب CPM.
 */
export const regionalCalendarCountries: RegionalCalendarCountry[] = [
  {
    code: "EG",
    label: "مصر — السبت إلى الخميس",
    holidayCountryCode: "EG",
    workingWeekdays: [0, 1, 2, 3, 4, 6],
    defaultHoursPerDay: 8,
  },
  {
    code: "SA",
    label: "السعودية — الأحد إلى الخميس",
    holidayCountryCode: "SA",
    workingWeekdays: [0, 1, 2, 3, 4],
    defaultHoursPerDay: 8,
  },
  {
    code: "AE",
    label: "الإمارات — الإثنين إلى الجمعة",
    holidayCountryCode: "AE",
    workingWeekdays: [1, 2, 3, 4, 5],
    defaultHoursPerDay: 8,
  },
  {
    code: "QA",
    label: "قطر — الأحد إلى الخميس",
    holidayCountryCode: "QA",
    workingWeekdays: [0, 1, 2, 3, 4],
    defaultHoursPerDay: 8,
  },
  {
    code: "KW",
    label: "الكويت — الأحد إلى الخميس",
    holidayCountryCode: "KW",
    workingWeekdays: [0, 1, 2, 3, 4],
    defaultHoursPerDay: 8,
  },
  {
    code: "BH",
    label: "البحرين — الأحد إلى الخميس",
    holidayCountryCode: "BH",
    workingWeekdays: [0, 1, 2, 3, 4],
    defaultHoursPerDay: 8,
  },
  {
    code: "OM",
    label: "عُمان — الأحد إلى الخميس",
    holidayCountryCode: "OM",
    workingWeekdays: [0, 1, 2, 3, 4],
    defaultHoursPerDay: 8,
  },
  {
    code: "JO",
    label: "الأردن — الأحد إلى الخميس",
    holidayCountryCode: "JO",
    workingWeekdays: [0, 1, 2, 3, 4],
    defaultHoursPerDay: 8,
  },
  {
    code: "IQ",
    label: "العراق — الأحد إلى الخميس",
    holidayCountryCode: "IQ",
    workingWeekdays: [0, 1, 2, 3, 4],
    defaultHoursPerDay: 8,
  },
  {
    code: "MA",
    label: "المغرب — الإثنين إلى الجمعة",
    holidayCountryCode: "MA",
    workingWeekdays: [1, 2, 3, 4, 5],
    defaultHoursPerDay: 8,
  },
  {
    code: "TN",
    label: "تونس — الإثنين إلى الجمعة",
    holidayCountryCode: "TN",
    workingWeekdays: [1, 2, 3, 4, 5],
    defaultHoursPerDay: 8,
  },
  {
    code: "DZ",
    label: "الجزائر — الأحد إلى الخميس",
    holidayCountryCode: "DZ",
    workingWeekdays: [0, 1, 2, 3, 4],
    defaultHoursPerDay: 8,
  },
];

export function findRegionalCalendarCountry(code?: string) {
  return regionalCalendarCountries.find(country => country.code === code);
}

export function regionalCalendarForCountry(
  country: RegionalCalendarCountry,
  existing?: WorkingCalendar
): WorkingCalendar {
  return {
    id: existing?.id ?? `regional-${country.code.toLowerCase()}`,
    name: `تقويم ${country.label.split(" — ")[0]}`,
    workingWeekdays: country.workingWeekdays,
    holidays: existing?.holidays ?? [],
    holidayLabels: existing?.holidayLabels,
    hoursPerDay: existing?.hoursPerDay ?? country.defaultHoursPerDay,
    countryCode: country.code,
    holidaySource: existing?.holidaySource ?? "يدوي / لم يُحدّث بعد",
    holidaysLastCheckedAt: existing?.holidaysLastCheckedAt,
    holidayReviewRequired: true,
  };
}

export type PublicHoliday = { date: string; label: string };

type NagerHoliday = { date?: string; localName?: string; name?: string };

/**
 * مزامنة يدوية عند طلب المستخدم فقط؛ لا تعمل في الخلفية ولا ترسل ملف المشروع.
 * المخرجات تحتاج مراجعة خاصةً للأعياد الهجرية والقرارات الحكومية المتغيرة.
 */
export async function loadPublicHolidays(
  countryCode: string,
  year: number,
  request: typeof fetch = fetch
): Promise<PublicHoliday[]> {
  const response = await request(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`
  );
  if (!response.ok) {
    throw new Error("مصدر الإجازات لم يرد بقائمة صالحة الآن.");
  }
  const payload = (await response.json()) as NagerHoliday[];
  const holidays = payload
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date ?? ""))
    .map(item => ({
      date: item.date as string,
      label: item.localName || item.name || "إجازة عامة",
    }));
  if (!holidays.length) {
    throw new Error("لا توجد إجازات منشورة لهذا البلد والسنة من المصدر الحالي.");
  }
  return holidays;
}
