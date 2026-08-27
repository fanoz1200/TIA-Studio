import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readProjectFile = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("عقد نسخة سطح المكتب", () => {
  it("يوفر غلاف Electron محلياً مع خادم مضمّن لا يعيد تشغيل EXE المحمول", () => {
    const main = readProjectFile("desktop/main.cjs");
    expect(main).toContain("TIA_DESKTOP_EMBEDDED");
    expect(main).toContain("serverModule.startServer()");
    expect(main).not.toContain("spawn(process.execPath");
    expect(main).toContain("nodeIntegration: false");
    expect(main).toContain("contextIsolation: true");
    expect(main).toContain("127.0.0.1");
    expect(main).toContain("?desktop=1&showSplash=1");
  });

  it("يوثق حدوده ويحتوي إعداد بناء مثبت وملف محمول", () => {
    const manifest = JSON.parse(readProjectFile("package.json")) as { scripts: Record<string, string>; build: Record<string, unknown> };
    expect(manifest.scripts["desktop:pack"]).toContain("electron-builder");
    expect(manifest.scripts["desktop:pack:windows:portable"]).toContain("--win portable");
    expect(manifest.scripts["desktop:pack:windows:setup"]).toContain("--win nsis");
    expect(manifest.scripts["desktop:pack:windows:setup"]).toContain("Windows-x64-Setup");
    expect(manifest.build.files).toContain("dist/**/*");
    expect(manifest.build.files).toContain("node_modules/**/*");
    expect(manifest.build.extraResources).toEqual([
      { from: "/home/ubuntu/webdev-static-assets/tia-studio-opening-intro.mp3", to: "desktop-media/tia-studio-opening-intro.mp3" },
    ]);
    expect((manifest.build.win as { signAndEditExecutable: boolean }).signAndEditExecutable).toBe(false);
    expect((manifest.build.win as { signExecutable: boolean }).signExecutable).toBe(false);
    expect((manifest.build.win as { target: string[] }).target).toEqual(expect.arrayContaining(["nsis", "portable"]));
    expect((manifest.build.nsis as { script?: string }).script).toBeUndefined();
    expect((manifest.build.nsis as { runAfterFinish?: boolean }).runAfterFinish).toBe(false);
    expect(existsSync(resolve(root, "desktop/installer.nsi"))).toBe(false);
    expect(existsSync(resolve(root, "docs/TIA_STUDIO_DESKTOP_RELEASE_AR.md"))).toBe(true);
  });
});
