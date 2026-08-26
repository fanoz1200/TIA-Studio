import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProjectResourcesPanel } from "./ProjectResourcesPanel";

function renderPanel(language: "ar" | "en" = "ar", view = "resources") {
  window.localStorage.setItem("tia-studio-interface-language", language);
  return render(<LanguageProvider><ProjectResourcesPanel view={view} /></LanguageProvider>);
}

describe("ProjectResourcesPanel", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("يعرض الأدلة والأمثلة القابلة للتنزيل وحدود المعالجة المحلية", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "مركز المعرفة والتنزيل · Knowledge and download center" })).toBeTruthy();
    expect(screen.getByText("لا يعتمد المحرك الحالي على الذكاء الاصطناعي لاتخاذ نتيجة التحليل.")).toBeTruthy();
    expect(screen.getByText("01 — برنامج الأساس").closest("a")?.getAttribute("href")).toBe("/manus-storage/01-baseline-schedule_1dcca83b.json");
    expect(screen.getAllByText("تنزيل · Download")).toHaveLength(11);
    expect(screen.getByText("حزمة المصدر والاستمرارية — 1.0.7 · Source and continuity package — 1.0.7").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.7-Source.tar_2eb10450.gz");
    expect(screen.getByText(/دليل استمرارية المشروع وتسليمه/).closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/PROJECT_CONTINUITY_AND_HANDOFF_AR_2338b203.md");
    const setupResourceLink = screen.getByText("نسخة سطح المكتب — Windows 1.0.12 Setup (الموصى بها) · Desktop app — Windows 1.0.12 Setup (recommended)").closest("article")?.querySelector("a");
    expect(setupResourceLink?.getAttribute("href")).toBe("https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Setup.exe");
    expect(setupResourceLink?.getAttribute("target")).toBe("_blank");
    expect(setupResourceLink?.getAttribute("rel")).toBe("noreferrer");
    expect(setupResourceLink?.getAttribute("download")).toBeNull();
    expect(screen.getByText("نسخة سطح المكتب — Windows 1.0.12 المحمولة · Desktop app — Windows 1.0.12 Portable").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Portable.exe");
    expect(screen.getByText(/بصمات Windows 1.0.12 — SHA-256/).closest("article")?.querySelector("a")?.getAttribute("href")).toBe("https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-SHA256SUMS.txt");
    expect(screen.getByText(/نسخة سطح المكتب — Linux 1.0.7/).closest("article")?.querySelector("a")?.getAttribute("href")).toBe("/manus-storage/TIA-Studio-1.0.7-Linux-x64_8ef18634.AppImage");
    const fallbackSetupLink = screen.getByRole("link", { name: /تحميل Setup لـ Windows/ });
    expect(fallbackSetupLink.getAttribute("href")).toBe("https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Setup.exe");
    expect(fallbackSetupLink.getAttribute("target")).toBe("_blank");
    expect(fallbackSetupLink.getAttribute("rel")).toBe("noreferrer");
    expect(screen.getByRole("link", { name: /Windows 1.0.12 — Setup/ }).getAttribute("href")).toBe("https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Setup.exe");
    expect(screen.getByRole("link", { name: /Windows 1.0.12 — محمول/ }).getAttribute("href")).toBe("https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Portable.exe");
    expect(screen.getByRole("heading", { name: "الدليل الحيّ: كيف يعمل البرنامج من البداية للنهاية؟ · Live guide: how does the app work end-to-end?" })).toBeTruthy();
    expect(screen.getByText("الإصدار · Release 1.0.12")).toBeTruthy();
    expect(screen.getByText("تشغيل محلي بنقرة واحدة · One-click local launch")).toBeTruthy();
    expect(screen.getByText("محرك CPM الحتمي والتقويم الإقليمي")).toBeTruthy();
    expect(screen.getByText("سجل تغييرات هذا الإصدار · Changes in this release")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Workshop NO8 — مرجع TIA مرفوع من المستخدم" })).toBeTruthy();
    expect(screen.getByText("+17 يوم عمل · working days")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "قائمة مراجعة P6 قبل الاعتماد · P6 review checklist before reliance" })).toBeTruthy();
    expect(screen.getByText(/لا يفك ترميز نمط تقويم P6 أو الاستثناءات تلقائياً/)).toBeTruthy();
    expect(screen.getByText(/نفّذ Schedule \(F9\)/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Workshop NO8/i })).toBeNull();
  });

  it("لا يعرض محتوى المركز عندما يكون التبويب مختلفاً", () => {
    const { container } = renderPanel("ar", "overview");
    expect(container.innerHTML).toBe("");
  });

  it("يعرض نصوص مركز الموارد بالإنجليزية واتجاه LTR مع حفظ روابط الإصدار وبيانات التدريب", () => {
    renderPanel("en");

    expect(screen.getByRole("heading", { name: "Knowledge and download center" })).toBeTruthy();
    expect(screen.queryByText("مركز المعرفة والتنزيل · Knowledge and download center")).toBeNull();
    expect(document.querySelector('[aria-label="Project resources and downloads"]')?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("heading", { name: "Live guide: how does the app work end-to-end?" })).toBeTruthy();
    expect(screen.getByText("One-click local launch")).toBeTruthy();
    expect(screen.getByText("Deterministic CPM engine and regional calendar")).toBeTruthy();
    expect(screen.getByText(/Start in the knowledge centre to identify the event type/)).toBeTruthy();
    expect(screen.getByText(/The quality gate precedes Fragnet and TIA/)).toBeTruthy();
    expect(screen.getByText(/Version 1.0.12: a clear interface-language choice/)).toBeTruthy();
    expect(screen.getByText("Desktop app — Windows 1.0.12 Setup (recommended)").closest("article")?.querySelector("a")?.getAttribute("href")).toBe("https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Setup.exe");
    expect(screen.getByRole("link", { name: "Windows 1.0.12 — Portable" }).getAttribute("href")).toBe("https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Portable.exe");
    expect(screen.getByRole("heading", { name: "Workshop NO8 — مرجع TIA مرفوع من المستخدم" })).toBeTruthy();
    expect(screen.getByText("+17 working days")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Does the app rely on artificial intelligence?" })).toBeTruthy();
  });
});
