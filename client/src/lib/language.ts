export type AppLanguage = "ar" | "en";
export type DocumentLanguage = AppLanguage;

export const languageMeta: Record<AppLanguage, { dir: "rtl" | "ltr"; locale: string; label: string }> = {
  ar: { dir: "rtl", locale: "ar-EG", label: "العربية" },
  en: { dir: "ltr", locale: "en-GB", label: "English" },
};

export function languageDirection(language: AppLanguage) {
  return languageMeta[language].dir;
}

export function documentLocale(language: DocumentLanguage) {
  return languageMeta[language].locale;
}

/**
 * UI chrome only: Arabic mode keeps the English professional term beside its
 * Arabic equivalent. User-entered data, imported schedule content and engine
 * output must not be passed to this formatter.
 */
export function bilingualUiLabel(language: AppLanguage, arabic: string, english: string) {
  return language === "en" ? english : `${arabic} · ${english}`;
}
