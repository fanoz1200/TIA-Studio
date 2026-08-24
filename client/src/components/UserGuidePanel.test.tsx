import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserGuidePanel } from "./UserGuidePanel";

afterEach(() => cleanup());

describe("مرجع الاستخدام المصوّر", () => {
  it("لا يظهر خارج تبويب الدليل", () => {
    const { container } = render(<UserGuidePanel view="guided" onNavigate={vi.fn()} />);
    expect(container.textContent).toBe("");
  });

  it("يعرض خطوات العمل ويربط كل خطوة بالشاشة الحقيقية", () => {
    const onNavigate = vi.fn();
    render(<UserGuidePanel view="guide" onNavigate={onNavigate} />);

    expect(screen.getByRole("heading", { name: "امشي معايا خطوة خطوة" })).toBeTruthy();
    expect(screen.getByText(/عندي اعتماد متأخر/)).toBeTruthy();
    const realScreenshot = screen.getByRole("img", { name: /لقطة فعلية من TIA Studio: ابدأ وعرّف الحالة/ });
    expect(realScreenshot.getAttribute("src")).toContain("step-1-start_");
    fireEvent.click(screen.getByRole("button", { name: /ارفع نسخ البرنامج/ }));
    fireEvent.click(screen.getByRole("button", { name: "افتح رفع P6" }));
    expect(onNavigate).toHaveBeenCalledWith("schedule");
  });

  it("يشرح مسارات مستندات المطالبة بدون تقديمها كقرار قانوني تلقائي", () => {
    const onNavigate = vi.fn();
    render(<UserGuidePanel view="guide" onNavigate={onNavigate} />);

    expect(screen.getByText("Notice of Claim")).toBeTruthy();
    expect(screen.getByText("Delay Analysis Narrative")).toBeTruthy();
    expect(screen.getByText("Full Claim")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /افتح المسار/ })[0]);
    expect(onNavigate).toHaveBeenCalledWith("notices");
  });
});
