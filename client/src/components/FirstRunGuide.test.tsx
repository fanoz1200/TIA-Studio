import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_RUN_GUIDE_STORAGE_KEY,
  FirstRunGuide,
  shouldShowFirstRunGuide,
} from "./FirstRunGuide";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("شاشة شرح أول تشغيل", () => {
  it("تظهر أول مرة وتعرض خطوات المسار الحقيقي", () => {
    expect(shouldShowFirstRunGuide()).toBe(true);
    render(<FirstRunGuide open onOpenChange={vi.fn()} onStartAnalysis={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("اختار طريقك")).toBeTruthy();
    expect(screen.getByText("ارفع الـ Baseline")).toBeTruthy();
    expect(screen.getByText("نزّل التقرير")).toBeTruthy();
  });

  it("يحفظ الإخفاء وينقل المستخدم لبداية رحلة التحليل عند «ابدأ معايا»", () => {
    const onOpenChange = vi.fn();
    const onStartAnalysis = vi.fn();
    render(
      <FirstRunGuide
        open
        onOpenChange={onOpenChange}
        onStartAnalysis={onStartAnalysis}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "ابدأ معايا" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onStartAnalysis).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(FIRST_RUN_GUIDE_STORAGE_KEY)).toBe("1");
    expect(shouldShowFirstRunGuide()).toBe(false);
  });

  it("يقفل الشرح من غير تغيير المسار لما المستخدم يختار فتح البرنامج مباشرة", () => {
    const onOpenChange = vi.fn();
    const onStartAnalysis = vi.fn();
    render(
      <FirstRunGuide
        open
        onOpenChange={onOpenChange}
        onStartAnalysis={onStartAnalysis}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "فهمت، افتح البرنامج" })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onStartAnalysis).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FIRST_RUN_GUIDE_STORAGE_KEY)).toBe("1");
  });
});
