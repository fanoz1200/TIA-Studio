import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readProjectFile = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("عقد نسخة سطح المكتب", () => {
  it("يوفر غلاف Electron محلياً دون تشغيل Node داخل واجهة المستخدم", () => {
    const main = readProjectFile("desktop/main.cjs");
    expect(main).toContain("ELECTRON_RUN_AS_NODE");
    expect(main).toContain("nodeIntegration: false");
    expect(main).toContain("contextIsolation: true");
    expect(main).toContain("127.0.0.1");
  });

  it("يوثق حدوده ويحتوي إعداد بناء مثبتاً", () => {
    const manifest = JSON.parse(readProjectFile("package.json")) as { scripts: Record<string, string>; build: Record<string, unknown> };
    expect(manifest.scripts["desktop:pack"]).toContain("electron-builder");
    expect(manifest.build.extraResources).toBeDefined();
    expect(existsSync(resolve(root, "docs/TIA_STUDIO_DESKTOP_RELEASE_AR.md"))).toBe(true);
  });
});
