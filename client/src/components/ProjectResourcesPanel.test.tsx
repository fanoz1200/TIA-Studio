import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectResourcesPanel } from "./ProjectResourcesPanel";

describe("ProjectResourcesPanel", () => {
  it("يعرض الأدلة والأمثلة القابلة للتنزيل وحدود المعالجة المحلية", () => {
    render(<ProjectResourcesPanel view="resources" />);

    expect(screen.getByRole("heading", { name: "مركز المعرفة والتنزيل" })).toBeTruthy();
    expect(screen.getByText("لا يعتمد المحرك الحالي على الذكاء الاصطناعي لاتخاذ نتيجة التحليل.")).toBeTruthy();
    expect(screen.getByText("01 — برنامج الأساس").closest("a")?.getAttribute("href")).toBe("/manus-storage/01-baseline-schedule_1dcca83b.json");
    expect(screen.getAllByText("تنزيل")).toHaveLength(8);
    expect(screen.getByText("حزمة مصدر التشغيل المحلي").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/tia-studio-source-package_0a28a8d2.zip");
    expect(screen.getByText("نسخة سطح المكتب — Windows").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.0-windows-x64-portable_a9431577.zip");
    expect(screen.getByText("نسخة سطح المكتب — Linux").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.0-linux-x64_8ac9e8fe.AppImage");
  });

  it("لا يعرض محتوى المركز عندما يكون التبويب مختلفاً", () => {
    const { container } = render(<ProjectResourcesPanel view="overview" />);
    expect(container.innerHTML).toBe("");
  });
});
