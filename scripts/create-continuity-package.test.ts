import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const generatorSource = readFileSync(resolve(projectRoot, "scripts", "create-continuity-package.mjs"), "utf8");
const handoverGuide = readFileSync(resolve(projectRoot, "docs", "CONTINUITY_AND_HANDOVER_AR.md"), "utf8");

describe("حزمة الاستمرارية اليدوية", () => {
  it("تعرض أمراً يدوياً واضحاً في package.json", () => {
    expect(packageJson.scripts["continuity:package"]).toBe("node scripts/create-continuity-package.mjs");
  });

  it("تولد أرشيفاً من ملفات Git المتعقبة فقط خارج مجلد المشروع", () => {
    expect(generatorSource).toContain('"archive", "--format=tar.gz"');
    expect(generatorSource).toContain("ensureOutsideRepository(outputDirectory)");
    expect(generatorSource).toContain('"status", "--porcelain", "--untracked-files=all"');
    expect(generatorSource).not.toContain("git bundle");
  });

  it("يوثق بوضوح عدم شمول البيانات الحساسة أو النسخ الاحتياطي التلقائي", () => {
    expect(generatorSource).toContain('automaticBackup: false');
    expect(generatorSource).toContain('"raw XER/XML/XLSX"');
    expect(handoverGuide).toContain("لا تنشئ نسخاً احتياطية تلقائية");
    expect(handoverGuide).toContain("ملفات العميل الخام");
  });
});
