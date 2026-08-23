import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();
const windowsAsar = path.join(projectRoot, "release", "win-unpacked", "resources", "app.asar");
const packagedElectron = path.join(projectRoot, "release", "linux-unpacked", "tia-delay-analysis");
const windowsServerEntry = path.join(
  projectRoot,
  "release",
  "win-unpacked",
  "resources",
  "app.asar",
  "dist",
  "index.js",
);

function chooseLocalPort(start = 4321) {
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      if (port > start + 20) {
        reject(new Error("لم يتوفر منفذ محلي لاختبار حزمة سطح المكتب."));
        return;
      }
      const tester = net.createServer();
      tester.once("error", () => tryPort(port + 1));
      tester.listen(port, "127.0.0.1", () => tester.close(() => resolve(port)));
    };
    tryPort(start);
  });
}

function waitForResponse(url, timeoutMs = 20_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(url, response => {
        const chunks = [];
        response.on("data", chunk => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode === 200 && body.includes("TIA Studio")) {
            resolve();
            return;
          }
          reject(new Error(`رد الخادم بحالة غير متوقعة: ${response.statusCode ?? "غير معروفة"}.`));
        });
      });
      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("لم يستجب خادم الحزمة خلال 20 ثانية."));
        } else {
          setTimeout(probe, 250);
        }
      });
    };
    probe();
  });
}

if (!existsSync(windowsAsar)) {
  throw new Error(`أرشيف حزمة Windows غير موجود: ${windowsAsar}`);
}
if (!existsSync(packagedElectron)) {
  throw new Error(`محرك Electron المحلي غير موجود: ${packagedElectron}`);
}

const port = await chooseLocalPort();
const child = spawn(packagedElectron, [windowsServerEntry], {
  // app.asar ملف وليس مجلداً، لذلك لا يجوز استخدام dirname لمسار ملف داخله
  // كدليل عمل. يشغّل Electron نقطة الدخول من داخل الأرشيف مع بقاء cwd صالحاً.
  cwd: path.dirname(windowsAsar),
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(port),
    TIA_DESKTOP_LOCAL: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let diagnostics = "";
child.stdout.on("data", chunk => {
  diagnostics += chunk.toString();
});
child.stderr.on("data", chunk => {
  diagnostics += chunk.toString();
});

try {
  await waitForResponse(`http://127.0.0.1:${port}/`);
  console.log(`PASS: بدأ خادم حزمة Windows من app.asar واستجاب على المنفذ ${port}.`);
} catch (error) {
  const detail = diagnostics.trim() ? `\nسجل الخادم:\n${diagnostics.trim()}` : "";
  throw new Error(`${error instanceof Error ? error.message : String(error)}${detail}`);
} finally {
  child.kill();
}
