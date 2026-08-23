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

    expect(resourcesPanel).toContain("حزمة المصدر والاستمرارية — 1.0.6");
    expect(resourcesPanel).toContain("TIA-Studio-1.0.6-source.tar_58e2e360.gz");
    expect(resourcesPanel).toContain("TIA-Studio-1.0.6-Windows-x64_0fe21948.exe");
    expect(resourcesPanel).toContain("TIA-Studio-1.0.6-Linux-x64_47877391.AppImage");
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
