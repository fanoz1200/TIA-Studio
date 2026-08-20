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
  });

  it("يشغّل الخادم من app.asar ويحتفظ بسجل خطأ قابل للإرسال", () => {
    const main = fs.readFileSync(path.join(projectRoot, "desktop", "main.cjs"), "utf8");
    expect(main).toContain('path.join(app.getAppPath(), "dist", "index.js")');
    expect(main).toContain("tia-studio-local-server.log");
    expect(main).toContain('stdio: ["ignore", "pipe", "pipe"]');
  });

  it("يلتزم الخادم بالمنفذ الذي يختاره تطبيق سطح المكتب", () => {
    const server = fs.readFileSync(path.join(projectRoot, "server", "_core", "index.ts"), "utf8");
    expect(server).toContain('parseInt(process.env.PORT || "3000", 10)');
    expect(server).toContain('process.env.TIA_DESKTOP_LOCAL === "1" ? "127.0.0.1" : "0.0.0.0"');
    expect(server).toContain("server.listen(port, host");
    expect(server).not.toContain("findAvailablePort(preferredPort)");
  });

  it("يطلب من الخادم المضمّن البقاء على حلقة الجهاز المحلية فقط", () => {
    const main = fs.readFileSync(path.join(projectRoot, "desktop", "main.cjs"), "utf8");
    expect(main).toContain('TIA_DESKTOP_LOCAL: "1"');
  });
});
