import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("حزمة سطح المكتب المحلية", () => {
  it("تضع الخادم وواجهته داخل app.asar بجوار الاعتمادات", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    expect(packageJson.build.files).toContain("dist/**/*");
    expect(packageJson.build.extraResources).toBeUndefined();
    expect(packageJson.scripts["desktop:verify:packaged"]).toBe("node desktop/verify-packaged-local-server.mjs");
    expect(packageJson.scripts["desktop:verify:windows-sandbox"]).toBe("bash desktop/verify-windows-package-wine.sh");
  });

  it("يشغّل الخادم المضمّن من app.asar ويحتفظ بسجل خطأ قابل للإرسال", () => {
    const main = fs.readFileSync(path.join(projectRoot, "desktop", "main.cjs"), "utf8");
    expect(main).toContain('path.join(app.getAppPath(), "dist", "index.js")');
    expect(main).toContain("tia-studio-local-server.log");
    expect(main).toContain("pathToFileURL(serverEntry).href");
    expect(main).toContain("serverModule.startServer()");
    expect(main).not.toContain("spawn(process.execPath");
  });

  it("يلتزم الخادم بالمنفذ الذي يختاره تطبيق سطح المكتب", () => {
    const server = fs.readFileSync(path.join(projectRoot, "server", "_core", "index.ts"), "utf8");
    expect(server).toContain('parseInt(process.env.PORT || "3000", 10)');
    expect(server).toContain('process.env.TIA_DESKTOP_LOCAL === "1" ? "127.0.0.1" : "0.0.0.0"');
    expect(server).toContain("server.listen(port, host");
    expect(server).not.toContain("findAvailablePort(preferredPort)");
  });

  it("لا يحمّل Vite مع خادم الإنتاج المعبأ في Windows", () => {
    const server = fs.readFileSync(path.join(projectRoot, "server", "_core", "index.ts"), "utf8");
    const staticServer = fs.readFileSync(path.join(projectRoot, "server", "_core", "static.ts"), "utf8");
    expect(server).toContain('import { serveStatic } from "./static"');
    expect(server).toContain("const viteEntry = pathToFileURL");
    expect(server).not.toContain('from "./vite"');
    expect(staticServer).not.toContain('from "vite"');
  });

  it("يطلب من الخادم المضمّن البقاء على حلقة الجهاز المحلية فقط", () => {
    const main = fs.readFileSync(path.join(projectRoot, "desktop", "main.cjs"), "utf8");
    expect(main).toContain('process.env.TIA_DESKTOP_LOCAL = "1"');
    expect(main).toContain('process.env.TIA_DESKTOP_EMBEDDED = "1"');
  });

  it("يوفر تحققاً معزولاً من ملف Windows واستجابة خادمه المحلي", () => {
    const verifier = fs.readFileSync(path.join(projectRoot, "desktop", "verify-windows-package-wine.sh"), "utf8");
    expect(verifier).toContain('WINEPREFIX="$WORK_DIR/wine-prefix"');
    expect(verifier).toContain('xvfb-run -a wine "$EXE_PATH"');
    expect(verifier).toContain('http://127.0.0.1:${port}/');
    expect(verifier).toContain('TIA Studio');
  });
});
