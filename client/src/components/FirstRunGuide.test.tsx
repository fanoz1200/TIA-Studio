import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import {
  FIRST_RUN_GUIDE_STORAGE_KEY,
  FirstRunGuide,
  shouldShowFirstRunGuide,
} from "./FirstRunGuide";

function renderGuide(onOpenChange = vi.fn(), onStartAnalysis = vi.fn()) {
  return render(
    <LanguageProvider>
      <FirstRunGuide open onOpenChange={onOpenChange} onStartAnalysis={onStartAnalysis} />
    </LanguageProvider>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("شاشة شرح أول تشغيل", () => {
  it("تظهر أول مرة وتعرض خطوات المسار الحقيقي", () => {
    expect(shouldShowFirstRunGuide()).toBe(true);
    renderGuide();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("اختار طريقك")).toBeTruthy();
    expect(screen.getByText("ارفع الـ Baseline")).toBeTruthy();
    expect(screen.getByText("نزّل التقرير")).toBeTruthy();
  });

  it("يحفظ الإخفاء وينقل المستخدم لبداية رحلة التحليل عند «ابدأ معايا»", () => {
    const onOpenChange = vi.fn();
    const onStartAnalysis = vi.fn();
    renderGuide(onOpenChange, onStartAnalysis);

    fireEvent.click(screen.getByRole("button", { name: "ابدأ معايا" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onStartAnalysis).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(FIRST_RUN_GUIDE_STORAGE_KEY)).toBe("1");
    expect(shouldShowFirstRunGuide()).toBe(false);
  });

  it("يقفل الشرح من غير تغيير المسار لما المستخدم يختار فتح البرنامج مباشرة", () => {
    const onOpenChange = vi.fn();
    const onStartAnalysis = vi.fn();
    renderGuide(onOpenChange, onStartAnalysis);

    fireEvent.click(
      screen.getByRole("button", { name: "فهمت، افتح البرنامج" })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onStartAnalysis).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FIRST_RUN_GUIDE_STORAGE_KEY)).toBe("1");
  });

  it("يعرض English باتجاه LTR مع بقاء تشغيل الرحلة وسجل الإكمال المحلي كما هما", () => {
    window.localStorage.setItem("tia-studio-interface-language", "en");
    const onOpenChange = vi.fn();
    const onStartAnalysis = vi.fn();
    renderGuide(onOpenChange, onStartAnalysis);

    expect(screen.getByText("Welcome to TIA Studio")).toBeTruthy();
    expect(screen.getByText("Choose your route")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start the analysis" })).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("dir")).toBe("ltr");

    fireEvent.click(screen.getByRole("button", { name: "Start the analysis" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onStartAnalysis).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(FIRST_RUN_GUIDE_STORAGE_KEY)).toBe("1");
  });
});
