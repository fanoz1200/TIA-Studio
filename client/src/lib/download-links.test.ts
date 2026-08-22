import { describe, expect, it } from "vitest";
import { PUBLIC_DOWNLOAD_ORIGIN, resolveResourceDownloadHref } from "./download-links";

describe("resolveResourceDownloadHref", () => {
  const packagePath = "/manus-storage/TIA-Studio-1.0.4-Windows-x64-Complete_cdfb8335.exe";

  it("يوجه تنزيلات نسخة Electron المحلية إلى النطاق العام", () => {
    expect(resolveResourceDownloadHref(packagePath, "127.0.0.1")).toBe(`${PUBLIC_DOWNLOAD_ORIGIN}${packagePath}`);
  });

  it("يبقي مسار التخزين نسبياً داخل النشر والاختبارات", () => {
    expect(resolveResourceDownloadHref(packagePath, "tiadelaytool-aq6zdeih.manus.space")).toBe(packagePath);
    expect(resolveResourceDownloadHref(packagePath, "localhost")).toBe(packagePath);
  });
});
