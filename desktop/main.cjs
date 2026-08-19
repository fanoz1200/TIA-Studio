const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

let serverProcess;

function findAvailablePort(start = 4317) {
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      const tester = net.createServer();
      tester.once("error", () => tryPort(port + 1));
      tester.listen(port, "127.0.0.1", () => tester.close(() => resolve(port)));
      if (port > start + 20) reject(new Error("لا يوجد منفذ محلي متاح لتشغيل TIA Studio."));
    };
    tryPort(start);
  });
}

function waitForLocalServer(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = require("http").get(url, response => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - started >= timeoutMs) {
          reject(new Error("لم يبدأ خادم TIA Studio المحلي في الوقت المتوقع."));
        } else {
          setTimeout(probe, 250);
        }
      });
    };
    probe();
  });
}

async function createWindow() {
  const port = await findAvailablePort();
  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, "dist", "index.js")
    : path.join(app.getAppPath(), "dist", "index.js");

  if (!fs.existsSync(serverEntry)) {
    throw new Error("ملفات التطبيق غير مبنية. شغّل أمر بناء سطح المكتب أولاً.");
  }

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: path.dirname(serverEntry),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  });

  const localUrl = `http://127.0.0.1:${port}/`;
  await waitForLocalServer(localUrl);

  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#f6f8fc",
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  window.once("ready-to-show", () => window.show());
  await window.loadURL(localUrl);
}

app.whenReady().then(createWindow).catch(error => {
  dialog.showErrorBox("تعذر تشغيل TIA Studio محلياً", error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
