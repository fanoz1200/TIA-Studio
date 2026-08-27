import type { Express } from "express";
import express from "express";
import fs from "fs";
import path from "path";

/**
 * يقدم واجهة الإنتاج المبنية فقط. لا يستورد Vite، لذلك يظل مناسباً
 * لتشغيل تطبيق Electron بعد أن تحذف حزمة Windows اعتمادات التطوير.
 */
export function serveStatic(app: Express) {
  // The packaged desktop app keeps opening media in Electron resources instead
  // of the web project. Only the local loopback desktop server exposes it.
  const electronProcess = process as NodeJS.Process & { resourcesPath?: string };
  const desktopMediaPath = process.env.TIA_DESKTOP_LOCAL === "1"
    ? path.join(electronProcess.resourcesPath || "", "desktop-media")
    : null;
  if (desktopMediaPath && fs.existsSync(desktopMediaPath)) {
    app.use("/desktop-media", express.static(desktopMediaPath, { fallthrough: false }));
  }
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      "Could not find the build directory: " +
        `${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
