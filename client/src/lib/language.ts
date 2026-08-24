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
