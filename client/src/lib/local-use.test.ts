import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("عقد التشغيل المحلي", () => {
  it("يعرّف تطبيقاً قابلاً للتثبيت ويخدم موارده الأساسية محلياً", () => {
    const manifest = JSON.parse(readProjectFile("client/public/manifest.webmanifest")) as Record<string, unknown>;
    const serviceWorker = readProjectFile("client/public/service-worker.js");

    expect(manifest.name).toBe("TIA Studio — تحليل التأخير");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(serviceWorker).toContain("addEventListener(\"install\"");
    expect(serviceWorker).toContain("addEventListener(\"fetch\"");
    expect(serviceWorker).toContain('CACHE_NAME = "tia-studio-shell-v2"');
    expect(serviceWorker).toContain('request.mode === "navigate"');
    expect(readProjectFile("client/src/main.tsx")).toContain("registration.update()");
  });

  it("يعرض مركز الموارد حزمة المصدر ويصرح بحدود العمل دون اتصال", () => {
    const resourcesPanel = readProjectFile("client/src/components/ProjectResourcesPanel.tsx");
    const localUseGuide = readProjectFile("docs/TIA_STUDIO_AI_AND_LOCAL_USE_AR.md");

    expect(resourcesPanel).toContain("حزمة المصدر والاستمرارية — 1.0.7");
    expect(resourcesPanel).toContain("TIA-Studio-1.0.7-Source.tar_2eb10450.gz");
    expect(resourcesPanel).toContain("releases/download/v1.0.11/TIA-Studio-1.0.11-Windows-x64-Setup.exe");
    expect(resourcesPanel).toContain("releases/download/v1.0.11/TIA-Studio-1.0.11-Windows-x64-Portable.exe");
    expect(resourcesPanel).toContain("releases/download/v1.0.11/TIA-Studio-1.0.11-Windows-x64-SHA256SUMS.txt");
    expect(resourcesPanel).toContain("TIA-Studio-1.0.7-Linux-x64_8ef18634.AppImage");
    expect(localUseGuide).toContain("دون اتصال");
    expect(localUseGuide).toContain("PWA");
  });

  it("يوثق مسار نسخة سطح المكتب وحدودها دون اتصال", () => {
    const desktopGuide = readProjectFile("docs/TIA_STUDIO_DESKTOP_RELEASE_AR.md");
    const packageJson = readProjectFile("package.json");

    expect(desktopGuide).toContain("127.0.0.1");
    expect(desktopGuide).toContain("دون اتصال");
    expect(desktopGuide).toContain("تجريبي محدود النطاق");
    expect(packageJson).toContain("desktop:pack");
  });
});
