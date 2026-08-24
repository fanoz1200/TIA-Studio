import { describe, expect, it } from "vitest";
import { documentLocale, languageDirection, languageMeta } from "./language";

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
});
