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
    expect(screen.getAllByText("تنزيل")).toHaveLength(9);
    expect(screen.getByText("حزمة المصدر والاستمرارية — 1.0.6").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.6-source.tar_58e2e360.gz");
    expect(screen.getByText("دليل استمرارية المشروع وتسليمه").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/PROJECT_CONTINUITY_AND_HANDOFF_AR_2338b203.md");
    expect(screen.getByText("نسخة سطح المكتب — Windows 1.0.6").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.6-Windows-x64_0fe21948.exe");
    expect(screen.getByText("نسخة سطح المكتب — Linux 1.0.6").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.6-Linux-x64_47877391.AppImage");
    expect(screen.getByRole("link", { name: /Windows 1.0.6 — تنزيل EXE/ }).getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.6-Windows-x64_0fe21948.exe");
    expect(screen.getByRole("link", { name: /Linux 1.0.6 — تنزيل AppImage/ }).getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.6-Linux-x64_47877391.AppImage");
    expect(screen.getByRole("heading", { name: "الدليل الحيّ: كيف يعمل البرنامج من البداية للنهاية؟" })).toBeTruthy();
    expect(screen.getByText("الإصدار 1.0.6")).toBeTruthy();
    expect(screen.getByText("تشغيل محلي بنقرة واحدة")).toBeTruthy();
    expect(screen.getByText("محرك CPM الحتمي")).toBeTruthy();
    expect(screen.getByText("سجل تغييرات هذا الإصدار")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Workshop NO8 — مرجع TIA مرفوع من المستخدم" })).toBeTruthy();
    expect(screen.getByText("+17 يوم عمل")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "قائمة مراجعة P6 قبل الاعتماد" })).toBeTruthy();
    expect(screen.getByText(/لا يفك ترميز نمط تقويم P6 أو الاستثناءات تلقائياً/)).toBeTruthy();
    expect(screen.getByText(/نفّذ Schedule \(F9\)/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Workshop NO8/i })).toBeNull();
  });

  it("لا يعرض محتوى المركز عندما يكون التبويب مختلفاً", () => {
    const { container } = render(<ProjectResourcesPanel view="overview" />);
    expect(container.innerHTML).toBe("");
  });
});
