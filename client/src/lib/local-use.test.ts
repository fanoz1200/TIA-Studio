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
  });

  it("يعرض مركز الموارد حزمة المصدر ويصرح بحدود العمل دون اتصال", () => {
    const resourcesPanel = readProjectFile("client/src/components/ProjectResourcesPanel.tsx");
    const localUseGuide = readProjectFile("docs/TIA_STUDIO_AI_AND_LOCAL_USE_AR.md");

    expect(resourcesPanel).toContain("حزمة مصدر التشغيل المحلي");
    expect(resourcesPanel).toContain("tia-studio-source-package_0a28a8d2.zip");
    expect(localUseGuide).toContain("دون اتصال");
    expect(localUseGuide).toContain("PWA");
  });
});
