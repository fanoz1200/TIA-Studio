import { describe, expect, it } from "vitest";
import { bilingualUiLabel, documentLocale, languageDirection, languageMeta } from "./language";

describe("language contract", () => {
  it("maps Arabic to RTL and English to LTR", () => {
    expect(languageDirection("ar")).toBe("rtl");
    expect(languageDirection("en")).toBe("ltr");
  });

  it("provides explicit document locales for both supported languages", () => {
    expect(documentLocale("ar")).toBe("ar-EG");
    expect(documentLocale("en")).toBe("en-GB");
    expect(languageMeta.en.label).toBe("English");
  });

  it("keeps professional UI labels bilingual in Arabic and English-only in English", () => {
    expect(bilingualUiLabel("ar", "التحليل الزمني", "Time impact analysis")).toBe("التحليل الزمني · Time impact analysis");
    expect(bilingualUiLabel("en", "التحليل الزمني", "Time impact analysis")).toBe("Time impact analysis");
  });
});
