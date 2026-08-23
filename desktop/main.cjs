const { app, BrowserWindow, dialog } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let localServer;
let serverFailure = "";

function getLocalServerLogPath() {
  return path.join(app.getPath("userData"), "tia-studio-local-server.log");
}

function appendServerLog(message) {
  fs.appendFileSync(getLocalServerLogPath(), `${new Date().toISOString()} ${message}\n`, "utf8");
}

function findAvailablePort(start = 4317) {
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      if (port > start + 20) {
        reject(new Error("لا يوجد منفذ محلي متاح لتشغيل TIA Studio."));
        return;
      }
      const tester = net.createServer();
      tester.once("error", () => tryPort(port + 1));
      tester.listen(port, "127.0.0.1", () => tester.close(() => resolve(port)));
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
          const detail = serverFailure ? ` السبب: ${serverFailure}` : "";
          reject(new Error(`لم يبدأ خادم TIA Studio المحلي في الوقت المتوقع.${detail} راجع سجل التشغيل: ${getLocalServerLogPath()}`));
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
  // يبدأ الخادم داخل عملية Electron نفسها. الحزمة المحمولة تُفك في Temp على Windows؛
  // لذلك لا نعتمد على إعادة تشغيل process.execPath من المسار المؤقت كعملية Node مستقلة.
  const serverEntry = path.join(app.getAppPath(), "dist", "index.js");

  if (!fs.existsSync(serverEntry)) {
    throw new Error("ملفات التطبيق غير مبنية. شغّل أمر بناء سطح المكتب أولاً.");
  }

  fs.writeFileSync(getLocalServerLogPath(), "بدء سجل خادم TIA Studio المحلي\n", "utf8");
  process.env.NODE_ENV = "production";
  process.env.PORT = String(port);
  process.env.TIA_DESKTOP_LOCAL = "1";
  process.env.TIA_DESKTOP_EMBEDDED = "1";

  try {
    const serverModule = await import(pathToFileURL(serverEntry).href);
    localServer = await serverModule.startServer();
    localServer.on("error", error => {
      serverFailure = error.message;
      appendServerLog(`خطأ في الخادم المضمّن: ${serverFailure}`);
    });
    appendServerLog(`بدأ الخادم المضمّن على المنفذ ${port}.`);
  } catch (error) {
    serverFailure = error instanceof Error ? error.message : String(error);
    appendServerLog(`تعذر بدء الخادم المضمّن: ${serverFailure}`);
    throw error;
  }

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
  const message = error instanceof Error ? error.message : String(error);
  dialog.showErrorBox("تعذر تشغيل TIA Studio محلياً", `${message}\n\nأرسل ملف السجل المذكور أعلاه إلى فريق الدعم عند الحاجة.`);
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (localServer) localServer.close();
});
