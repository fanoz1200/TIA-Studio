import { describe, expect, it } from "vitest";
import { safeExternalVideoUrl, sanitizeMethodologyHtml } from "./knowledgeCentre";

describe("مركز المعرفة", () => {
  it("ينزع عناصر HTML النشطة ومسارات JavaScript من نسخة القراءة", () => {
    const html = sanitizeMethodologyHtml('<h1 onclick="steal()">TIA</h1><script>alert(1)</script><a href="javascript:bad()">رابط</a><p>نص مهني</p>');
    expect(html).toContain("TIA");
    expect(html).toContain("نص مهني");
    expect(html).not.toMatch(/script|onclick|javascript:/i);
  });

  it("يقبل روابط الفيديو الموثوقة عبر HTTPS فقط", () => {
    expect(safeExternalVideoUrl("https://www.youtube.com/watch?v=abc")).toBeTruthy();
    expect(safeExternalVideoUrl("https://vimeo.com/123456")).toBeTruthy();
    expect(safeExternalVideoUrl("http://youtube.com/watch?v=abc")).toBeNull();
    expect(safeExternalVideoUrl("https://example.com/lesson")).toBeNull();
  });
});
